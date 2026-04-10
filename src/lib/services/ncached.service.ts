import { Inject, Injectable, Optional } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { catchError, finalize, shareReplay, tap } from 'rxjs/operators';
import { NoopCompressor } from '../compressors/noop.compressor';
import { ICacheEntry } from '../interfaces/cache-entry.interface';
import { ICacheObject } from '../interfaces/cache-object.interface';
import { ICacheObservableOptions } from '../interfaces/cache-observable-options.interface';
import { ICompressor } from '../interfaces/compressor.interface';
import { INcachedConfig } from '../interfaces/ncached-config.interface';
import { ISetOptions } from '../interfaces/set-options.interface';
import { CacheServiceErrors } from '../namespaces/cache-service-errors.namespace';
import { NCACHED_CONFIG } from '../tokens/ncached-config.token';

/**
 * Hierarchical in-memory caching service for Angular applications.
 * Organizes cached data into namespaced Map instances with optional TTL,
 * Observable integration, request deduplication, and localStorage persistence.
 *
 * @example
 * ```typescript
 * // Basic usage
 * cache.set('Alice', 'users', 'currentUser');
 * cache.get<string>('users', 'currentUser'); // 'Alice'
 *
 * // With TTL
 * cache.set(tokenData, 'auth', 'token', { ttl: 3600000 });
 *
 * // Cache an HTTP call
 * cache.cacheObservable(http.get('/users'), { ttl: 30000 }, 'api', 'users');
 * ```
 */
@Injectable({
  providedIn: 'root'
})
export class NcachedService {

    /**
     * The root cache object containing nested namespaces and Map instances.
     * All cached data lives here in memory.
     */
    private _cache: ICacheObject = {};

    /**
     * The resolved compressor instance for the persistence layer.
     */
    private _compressor: ICompressor;

    /**
     * Library configuration, provided via NCACHED_CONFIG injection token.
     */
    private _config: INcachedConfig | null;

    /**
     * Map of in-flight observables keyed by serialized cache keys.
     * Used for request deduplication.
     */
    private _inflight: Map<string, Observable<any>> = new Map();

    /**
     * @param config - Optional library configuration injected via NCACHED_CONFIG token.
     *                 When null, the service operates without persistence.
     */
    constructor(@Optional() @Inject(NCACHED_CONFIG) config: INcachedConfig | null) {
      this._config = config ?? null;
      this._compressor = config?.persistence?.compressor ?? new NoopCompressor();

      if (config?.persistence?.enabled) {
        this._hydrate();
        this._registerBeforeUnload();
      }
    }
  
    /**
     * Deserializes a JSON string into an ICacheObject, reconstructing Maps.
     * Discards expired entries during reconstruction.
     *
     * @param json - JSON string produced by _serialize()
     * @returns Reconstructed ICacheObject with Maps restored and expired entries removed
     */
    private _deserialize(json: string): ICacheObject {
      const parsed = JSON.parse(json);
      return this._restoreMaps(parsed);
    }

    /**
     * Recursively searches for a value in the cache using the given keys.
     * Unwraps the ICacheEntry and checks TTL expiration. If the entry is expired,
     * it is deleted from the Map before throwing.
     *
     * @param keys - Navigation keys (min 2). All keys except the last navigate the hierarchy;
     *               the last key is used for the Map lookup.
     * @returns The cached value of type T, unwrapped from its ICacheEntry container
     * @throws {CacheServiceErrors.InsufficientsKeysProvidedError} If fewer than two keys are provided
     * @throws {CacheServiceErrors.KeyNotFound} If a navigation key does not exist in the hierarchy
     * @throws {CacheServiceErrors.MapNotFound} If a navigation key does not point to a Map
     * @throws {CacheServiceErrors.ValueNotFound} If the map entry key is missing or the entry has expired
     */
    private _findInCache<T = any>(...keys: string[]): T {
      if (keys.length < 2) {
        throw new CacheServiceErrors.InsufficientsKeysProvidedError();
      }

      const map = this._findMap<ICacheEntry<T>>(this._cache, ...keys.slice(0, keys.length - 1));
      const mapKey = keys[keys.length - 1];

      if (!map.has(mapKey)) {
        throw new CacheServiceErrors.ValueNotFound(mapKey);
      }

      const entry = map.get(mapKey)!;

      if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
        map.delete(mapKey);
        throw new CacheServiceErrors.ValueNotFound(mapKey);
      }

      return entry.value;
    }
  
    /**
     * Recursively navigates the cache hierarchy to locate the target Map.
     * Each key except the last peels one level of ICacheObject nesting;
     * the final key must resolve to a Map instance.
     *
     * @param cacheObj - The current level of the cache hierarchy to search
     * @param keys - One or more navigation keys leading to the target Map
     * @returns The Map instance found at the end of the key chain
     * @throws {CacheServiceErrors.KeyNotFound} If a navigation key does not exist in the hierarchy
     * @throws {CacheServiceErrors.MapNotFound} If the final key does not point to a Map instance
     */
    private _findMap<T = any>(cacheObj: ICacheObject | Map<string, T>, ...keys: string[]): Map<string, T> {
      if (keys.length >= 1 && !(keys[0] in cacheObj)) {
        throw new CacheServiceErrors.KeyNotFound(keys[0]);
      }
  
      const obj = (cacheObj as ICacheObject)[keys[0]];
  
      if (keys.length === 1) {
        if (obj instanceof Map) {
          return obj;
        }
  
        throw new CacheServiceErrors.MapNotFound(keys[0]);
      }
  
      return this._findMap(obj as ICacheObject, ...keys.slice(1));
    }

    /**
     * Hydrates the in-memory cache from localStorage.
     * Reads the stored snapshot, decompresses it, and deserializes into the cache structure.
     * Expired entries are discarded during deserialization.
     * On any failure (missing data, invalid JSON, decompression error), resets to an empty cache.
     */
    private _hydrate(): void {
      const storageKey = this._config?.persistence?.storageKey ?? 'ncached_snapshot';

      try {
        const raw = localStorage.getItem(storageKey);

        if (!raw) {
          return;
        }

        const json = this._compressor.decompress(raw);
        this._cache = this._deserialize(json);
      } catch {
        this._cache = {};
      }
    }

    /**
     * Parses the variadic arguments of set() to separate string keys from an optional
     * trailing ISetOptions object. If the last element is a non-null object, it is
     * extracted as options; all remaining elements are treated as string keys.
     *
     * @param args - Mixed array of string keys and an optional ISetOptions as the last element
     * @returns An object with `keys` (string[]) and `options` (ISetOptions | undefined)
     */
    private _parseSetArgs(args: Array<string | ISetOptions>): { keys: string[]; options: ISetOptions | undefined } {
      const lastArg = args[args.length - 1];

      return typeof lastArg === 'object' && lastArg !== null
        ? { keys: args.slice(0, -1) as string[], options: lastArg as ISetOptions }
        : { keys: args as string[], options: undefined };
    }

    /**
     * Persists the in-memory cache to localStorage.
     * Serializes the cache to JSON, compresses it via the configured ICompressor,
     * and writes the result to localStorage. If the write fails (e.g. QuotaExceededError),
     * logs a warning and continues — the app keeps working, just without persistence.
     */
    private _persist(): void {
      const storageKey = this._config?.persistence?.storageKey ?? 'ncached_snapshot';

      try {
        const json = this._serialize();
        const compressed = this._compressor.compress(json);
        localStorage.setItem(storageKey, compressed);
      } catch (error) {
        console.warn('[ncached] Failed to persist cache to localStorage:', error);
      }
    }

    /**
     * Registers a beforeunload event listener that persists the cache.
     */
    private _registerBeforeUnload(): void {
      window.addEventListener('beforeunload', () => {
        this._persist();
      });
    }

    /**
     * Recursively walks the parsed JSON tree, converting nodes with a `__mapEntries`
     * array back into Map instances. Expired entries (expiresAt < now) are dropped.
     *
     * @param obj - A plain object produced by JSON.parse of a _serialize() output
     * @returns Reconstructed ICacheObject with Maps restored and expired entries filtered out
     */
    private _restoreMaps(obj: Record<string, any>): ICacheObject {
      const result: ICacheObject = {};
      const now = Date.now();

      for (const key of Object.keys(obj)) {
        const node = obj[key];

        if (node && Array.isArray(node.__mapEntries)) {
          const map = new Map<string, ICacheEntry<any>>();

          for (const [entryKey, entry] of node.__mapEntries) {
            if (entry.expiresAt === null || entry.expiresAt > now) {
              map.set(entryKey, entry);
            }
          }

          result[key] = map;
        } else if (node && typeof node === 'object') {
          result[key] = this._restoreMaps(node);
        }
      }

      return result;
    }

    /**
     * Serializes the in-memory cache to a JSON string.
     * Converts Maps to a JSON-safe format with __mapEntries arrays.
     *
     * @returns JSON string representation of the cache
     */
    private _serialize(): string {
      return JSON.stringify(this._cache, (_key, value) => {
        if (value instanceof Map) {
          return { __mapEntries: Array.from(value.entries()) };
        }
        return value;
      });
    }

    /**
     * Recursively navigates the cache hierarchy and stores the value wrapped in ICacheEntry.
     * Auto-creates intermediate ICacheObject nodes and leaf Maps as needed.
     *
     * @param cacheObj - Current level of the cache hierarchy
     * @param value - Value to store
     * @param options - Optional set options (TTL)
     * @param keys - Remaining navigation keys
     * @returns ICacheObject if recursing, undefined when value is set
     */
    private _setInCache<T = any>(cacheObj: ICacheObject, value: T, options: ISetOptions | undefined, ...keys: string[]): ICacheObject | undefined {
      if (keys.length > 2) {
        if (!cacheObj[keys[0]]) {
          cacheObj[keys[0]] = {};
        }

        return this._setInCache(cacheObj[keys[0]] as ICacheObject, value, options, ...keys.slice(1));
      }

      if (!(cacheObj[keys[0]] instanceof Map)) {
        cacheObj[keys[0]] = new Map();
      }

      const entry: ICacheEntry<T> = {
        value,
        expiresAt: options?.ttl != null ? Date.now() + options.ttl : null
      };

      (cacheObj[keys[0]] as Map<string, ICacheEntry<T>>).set(keys[1], entry);

      return;
    }
  
    /**
     * Clears an entire subtree or map layer from the cache.
     * Navigates to the parent using all keys except the last, then deletes the last key's entry.
     * No-op if the path does not exist.
     *
     * @param keys - Keys identifying the subtree to clear (min 1)
     * @returns void
     *
     * @example
     * ```typescript
     * cache.set('a', 'users', 'key1');
     * cache.set('b', 'users', 'key2');
     * cache.clear('users'); // removes the entire 'users' namespace
     *
     * cache.clear('nonexistent'); // no-op, does not throw
     * ```
     */
    public clear(...keys: string[]): void {
      if (keys.length === 0) {
        return;
      }

      let target: ICacheObject = this._cache;

      for (let i = 0; i < keys.length - 1; i++) {
        if (!(keys[i] in target)) {
          return;
        }
        target = target[keys[i]] as ICacheObject;
      }

      delete target[keys[keys.length - 1]];
    }

    /**
     * Wipes the entire in-memory cache.
     * If persistence is enabled, also removes the localStorage entry.
     *
     * @returns void
     *
     * @example
     * ```typescript
     * cache.set('a', 'mod1', 'key');
     * cache.set('b', 'mod2', 'key');
     * cache.clearAll(); // cache is now empty
     * ```
     */
    public clearAll(): void {
      this._cache = {};

      if (this._config?.persistence?.enabled) {
        const storageKey = this._config.persistence.storageKey ?? 'ncached_snapshot';

        try {
          localStorage.removeItem(storageKey);
        } catch {
          // Ignore — clearing storage is best-effort
        }
      }
    }

    /**
     * Caches the result of an Observable source using the given keys.
     *
     * On cache hit, returns the cached value immediately via `of()` without
     * subscribing to the source. On cache miss, subscribes to the source,
     * stores the result (with optional TTL), and emits it. If the source errors,
     * emits `defaultValue` when provided, otherwise re-throws.
     *
     * Concurrent calls with the same keys share a single source subscription
     * (request deduplication via shareReplay). The in-flight entry is cleaned
     * up automatically when the source completes or errors.
     *
     * @param source - The Observable to cache (typically an HttpClient call)
     * @param options - Configuration object with optional `ttl` and `defaultValue`
     * @param keys - Cache keys (same rules as get/set, min 2 string keys)
     * @returns An Observable that emits the cached or freshly fetched value
     *
     * @example
     * ```typescript
     * // Cache an HTTP GET for 30 seconds
     * this._cache.cacheObservable(
     *   this._http.get<IUser[]>('/api/users'),
     *   { ttl: 30000 },
     *   'api', 'users'
     * ).subscribe(users => console.log(users));
     *
     * // With a fallback value on error
     * this._cache.cacheObservable(
     *   this._http.get<IConfig>('/api/config'),
     *   { ttl: 60000, defaultValue: DEFAULT_CONFIG },
     *   'api', 'config'
     * );
     * ```
     */
    public cacheObservable<T = any>(source: Observable<T>, options: ICacheObservableOptions<T>, ...keys: string[]): Observable<T> {
      try {
        const cached = this.get<T>(...keys);
        return of(cached);
      } catch {
        // Not in cache or expired — proceed
      }

      const flightKey = keys.join('::');

      if (this._inflight.has(flightKey)) {
        return this._inflight.get(flightKey)! as Observable<T>;
      }

      const shared$ = source.pipe(
        tap(value => {
          this._setInCache<T>(this._cache, value, options.ttl != null ? { ttl: options.ttl } : undefined, ...keys);
        }),
        catchError(error => {
          if ('defaultValue' in options) {
            return of(options.defaultValue as T);
          }
          return throwError(() => error);
        }),
        finalize(() => {
          this._inflight.delete(flightKey);
        }),
        shareReplay({ bufferSize: 1, refCount: true })
      );

      this._inflight.set(flightKey, shared$);

      return shared$;
    }

    /**
     * Retrieves a cached value by navigating the hierarchy with the given keys.
     * The last key is used as the Map lookup key; all preceding keys navigate the hierarchy.
     *
     * @param keys - Navigation keys (min 2). All but the last navigate; the last is the Map entry key.
     * @returns The cached value of type T
     * @throws {CacheServiceErrors.InsufficientsKeysProvidedError} If fewer than two keys are provided
     * @throws {CacheServiceErrors.KeyNotFound} If a navigation key does not exist
     * @throws {CacheServiceErrors.ValueNotFound} If the entry is missing or has expired
     *
     * @example
     * ```typescript
     * cache.set('Alice', 'users', 'currentUser');
     * const name = cache.get<string>('users', 'currentUser'); // 'Alice'
     *
     * // Deep nesting
     * cache.set(42, 'app', 'settings', 'maxRetries');
     * cache.get<number>('app', 'settings', 'maxRetries'); // 42
     * ```
     */
    public get<T = any>(...keys: string[]): T {
      return this._findInCache<T>(...keys) as T;
    }
  
    /**
     * Retrieves a cached value, returning a default if the key is missing or expired.
     * Unlike get(), this method never throws for missing or expired entries.
     *
     * @param defaultValue - Value to return when the cache entry is missing or expired
     * @param keys - Navigation keys (same rules as get())
     * @returns The cached value if found and not expired, otherwise defaultValue
     *
     * @example
     * ```typescript
     * const theme = cache.getOrDefault('light', 'ui', 'theme'); // 'light' if not cached
     *
     * cache.set('dark', 'ui', 'theme');
     * cache.getOrDefault('light', 'ui', 'theme'); // 'dark' (cached value wins)
     * ```
     */
    public getOrDefault<T = any>(defaultValue: T, ...keys: string[]): T {
      try {
        return this.get<T>(...keys);
      } catch {
        return defaultValue;
      }
    }

    /**
     * Removes a specific cache entry identified by the given keys.
     * The last key is the Map entry key; preceding keys navigate the hierarchy.
     * No-op if the path or key does not exist.
     *
     * @param keys - Navigation keys (min 2)
     * @returns void
     *
     * @example
     * ```typescript
     * cache.set('val1', 'mod', 'key1');
     * cache.set('val2', 'mod', 'key2');
     * cache.remove('mod', 'key1'); // only key1 is removed
     * cache.get('mod', 'key2');    // 'val2' still available
     *
     * cache.remove('nonexistent', 'key'); // no-op, does not throw
     * ```
     */
    public remove(...keys: string[]): void {
      if (keys.length < 2) {
        return;
      }

      try {
        const map = this._findMap(this._cache, ...keys.slice(0, keys.length - 1));
        map.delete(keys[keys.length - 1]);
      } catch {
        // Path doesn't exist — nothing to remove
      }
    }

    /**
     * Stores a value in the cache at the location determined by the given keys.
     * An optional ISetOptions object can be passed as the last argument to configure TTL.
     * The value is internally wrapped in an ICacheEntry with expiration metadata.
     *
     * @param value - The value to cache
     * @param args - String keys (min 2) optionally followed by an ISetOptions object
     * @returns void
     * @throws {CacheServiceErrors.InsufficientsKeysProvidedError} If fewer than 2 string keys are provided
     *
     * @example
     * ```typescript
     * // Basic set (no expiration)
     * cache.set('Alice', 'users', 'currentUser');
     *
     * // With TTL (expires in 5 seconds)
     * cache.set(tokenData, 'auth', 'token', { ttl: 5000 });
     *
     * // Deep nesting
     * cache.set(42, 'app', 'settings', 'maxRetries');
     * ```
     */
    public set<T = any>(value: T, ...args: Array<string | ISetOptions>): void {
      const { keys, options } = this._parseSetArgs(args);

      if (keys.length < 2) {
        throw new CacheServiceErrors.InsufficientsKeysProvidedError();
      }

      this._setInCache(this._cache, value, options, ...keys);
    }
}
