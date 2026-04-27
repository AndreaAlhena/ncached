import { Inject, Injectable, Optional } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { catchError, finalize, shareReplay, tap } from 'rxjs/operators';
import structuredClonePolyfill from '@ungap/structured-clone';
import { NoopCompressor } from '../compressors/noop.compressor';
import { ICacheEntry } from '../interfaces/cache-entry.interface';
import { ICacheObject } from '../interfaces/cache-object.interface';
import { ICacheObservableOptions } from '../interfaces/cache-observable-options.interface';
import { ICompressor } from '../interfaces/compressor.interface';
import { INcachedConfig } from '../interfaces/ncached-config.interface';
import { ISetOptions } from '../interfaces/set-options.interface';
import { NcachedServiceErrors } from '../namespaces/ncached-service-errors.namespace';
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
     * Builds a fresh ICacheEntry wrapping `value` with the appropriate expiration
     * timestamp derived from the optional ISetOptions. The value is deep-cloned on
     * the way in so the cache holds an isolated copy.
     *
     * @template T The type of the value being stored
     * @param value - The value to wrap
     * @param options - Optional set options (TTL)
     * @param mapKey - The Map entry key the value will be stored under (forwarded to _clone for error diagnostics)
     * @returns A new ICacheEntry ready to be inserted into the leaf Map
     */
    private _buildCacheEntry<T>(value: T, options: ISetOptions | undefined, mapKey: string): ICacheEntry<T> {
      return {
        value: this._clone(value, mapKey),
        expiresAt: options?.ttl != null ? Date.now() + options.ttl : null
      };
    }

    /**
     * Builds the shared RxJS pipeline used by cacheObservable() on a cache miss.
     * The pipeline writes the emitted value into the cache, swaps source errors for
     * a user-supplied defaultValue when present, removes itself from the in-flight
     * registry on completion or error, and shares a single subscription across
     * concurrent callers via shareReplay.
     *
     * @template T The type of the Observable's emission
     * @param source - The upstream observable being cached
     * @param options - cacheObservable options (ttl, defaultValue)
     * @param keys - Cache keys (the path the emitted value will be stored under)
     * @param flightKey - The serialized key used to track this in-flight subscription
     * @returns A shared Observable that emits the freshly fetched and cached value
     */
    private _buildSourcePipeline<T>(source: Observable<T>, options: ICacheObservableOptions<T>, keys: string[], flightKey: string): Observable<T> {
      return source.pipe(
        tap(value => {
          const setOptions = options.ttl != null ? { ttl: options.ttl } : undefined;
          this._setInCache<T>(this._cache, value, setOptions, ...keys);
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
    }

    /**
     * Deep-clones a value using the platform's native structuredClone when available,
     * falling back to the @ungap/structured-clone polyfill on older runtimes.
     * Wraps platform DataCloneError instances in NcachedServiceErrors.UncloneableValueError
     * so consumers can discriminate clone failures via instanceof.
     *
     * @template T The type of the value being cloned
     * @param value - The value to deep-clone
     * @param key - The Map entry key associated with this value (used in the error message for diagnostics)
     * @returns A deep clone of the input value
     * @throws {NcachedServiceErrors.UncloneableValueError} If the value cannot be cloned (e.g. functions, DOM nodes)
     */
    private _clone<T>(value: T, key: string): T {
      try {
        return structuredClonePolyfill(value) as T;
      } catch (cause) {
        throw new NcachedServiceErrors.UncloneableValueError(key, cause);
      }
    }

    /**
     * Recursively walks the cache tree starting from `node` and pushes the full key path
     * of every non-expired Map entry into `paths`. Used internally by keys().
     *
     * @param node - The current node being traversed (either an ICacheObject or a leaf Map)
     * @param currentPath - The key path that led to `node` (accumulated during recursion)
     * @param paths - Output array, mutated in place with discovered key paths
     */
    private _collectKeyPaths(node: ICacheObject | Map<string, ICacheEntry<any>>, currentPath: string[], paths: string[][]): void {
      const now = Date.now();

      if (node instanceof Map) {
        for (const [mapKey, entry] of node.entries()) {
          if (!this._isExpired(entry, now)) {
            paths.push([...currentPath, mapKey]);
          }
        }

        return;
      }

      for (const key of Object.keys(node)) {
        const child = node[key];

        if (child instanceof Map || (child && typeof child === 'object')) {
          this._collectKeyPaths(child as ICacheObject | Map<string, ICacheEntry<any>>, [...currentPath, key], paths);
        }
      }
    }

    /**
     * Recursively counts non-expired Map entries reachable from `node`.
     * Used internally by size(). Does not mutate the cache.
     *
     * @param node - The current ICacheObject being walked
     * @returns The count of non-expired entries below this node
     */
    private _countEntries(node: ICacheObject): number {
      let count = 0;
      const now = Date.now();

      for (const key of Object.keys(node)) {
        const child = node[key];

        if (child instanceof Map) {
          for (const entry of child.values()) {
            if (!this._isExpired(entry, now)) {
              count++;
            }
          }
        } else if (child && typeof child === 'object') {
          count += this._countEntries(child as ICacheObject);
        }
      }

      return count;
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
     * @throws {NcachedServiceErrors.InsufficientsKeysProvidedError} If fewer than two keys are provided
     * @throws {NcachedServiceErrors.KeyNotFound} If a navigation key does not exist in the hierarchy
     * @throws {NcachedServiceErrors.MapNotFound} If a navigation key does not point to a Map
     * @throws {NcachedServiceErrors.ValueNotFound} If the map entry key is missing or the entry has expired
     */
    private _findInCache<T = any>(...keys: string[]): T {
      if (keys.length < 2) {
        throw new NcachedServiceErrors.InsufficientsKeysProvidedError();
      }

      const map = this._findMap<ICacheEntry<T>>(this._cache, ...keys.slice(0, keys.length - 1));
      const mapKey = keys[keys.length - 1];

      if (!map.has(mapKey)) {
        throw new NcachedServiceErrors.ValueNotFound(mapKey);
      }

      const entry = map.get(mapKey)!;

      if (this._isExpired(entry)) {
        map.delete(mapKey);
        throw new NcachedServiceErrors.ValueNotFound(mapKey);
      }

      return this._clone(entry.value, mapKey);
    }

    /**
     * Recursively navigates the cache hierarchy to locate the target Map.
     * Each key except the last peels one level of ICacheObject nesting;
     * the final key must resolve to a Map instance.
     *
     * @param cacheObj - The current level of the cache hierarchy to search
     * @param keys - One or more navigation keys leading to the target Map
     * @returns The Map instance found at the end of the key chain
     * @throws {NcachedServiceErrors.KeyNotFound} If a navigation key does not exist in the hierarchy
     * @throws {NcachedServiceErrors.MapNotFound} If the final key does not point to a Map instance
     */
    private _findMap<T = any>(cacheObj: ICacheObject | Map<string, T>, ...keys: string[]): Map<string, T> {
      if (keys.length >= 1 && !(keys[0] in cacheObj)) {
        throw new NcachedServiceErrors.KeyNotFound(keys[0]);
      }

      const obj = (cacheObj as ICacheObject)[keys[0]];

      if (keys.length === 1) {
        if (obj instanceof Map) {
          return obj;
        }

        throw new NcachedServiceErrors.MapNotFound(keys[0]);
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
      const storageKey = this._resolveStorageKey();

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
     * Checks whether an ICacheEntry has passed its expiration timestamp.
     * Centralises the TTL comparison so callers stay declarative — they ask
     * "is this expired?" rather than reimplementing the comparison.
     *
     * @param entry - The cache entry to check
     * @param now - Optional cached "now" timestamp (handy in loops to avoid repeated Date.now() calls)
     * @returns true if the entry has an expiresAt in the past, false otherwise
     */
    private _isExpired(entry: ICacheEntry<unknown>, now: number = Date.now()): boolean {
      return entry.expiresAt !== null && now > entry.expiresAt;
    }

    /**
     * Walks the cache tree following each key in `prefix` in order, returning the node
     * reached at the end. Returns null if any key in the prefix doesn't exist or if the
     * traversal hits a Map mid-prefix (which is invalid — Maps are leaves). Used by keys().
     *
     * @param root - The cache root to start from
     * @param prefix - Sequence of keys to follow
     * @returns The node at the end of the prefix, or null if the prefix is invalid
     */
    private _navigateToPrefix(root: ICacheObject, prefix: string[]): ICacheObject | Map<string, ICacheEntry<any>> | null {
      let current: ICacheObject | Map<string, ICacheEntry<any>> = root;

      for (const key of prefix) {
        if (current instanceof Map) {
          return null;
        }

        if (!(key in current)) {
          return null;
        }

        current = current[key] as ICacheObject | Map<string, ICacheEntry<any>>;
      }

      return current;
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
      const storageKey = this._resolveStorageKey();

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
     * Returns the localStorage key currently in effect for the persistence layer,
     * applying the documented `'ncached_snapshot'` default when no override is set.
     * Centralises the fallback so hydrate / persist / clearAll all stay in lockstep.
     *
     * @returns The configured storage key, or the default
     */
    private _resolveStorageKey(): string {
      return this._config?.persistence?.storageKey ?? 'ncached_snapshot';
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
     */
    private _setInCache<T = any>(cacheObj: ICacheObject, value: T, options: ISetOptions | undefined, ...keys: string[]): void {
      // Recurse through intermediate namespaces, auto-creating empty ICacheObject nodes as needed.
      if (keys.length > 2) {
        if (!cacheObj[keys[0]]) {
          cacheObj[keys[0]] = {};
        }

        this._setInCache(cacheObj[keys[0]] as ICacheObject, value, options, ...keys.slice(1));
        return;
      }

      // Leaf step: ensure the target Map exists, then build and insert the entry.
      if (!(cacheObj[keys[0]] instanceof Map)) {
        cacheObj[keys[0]] = new Map();
      }

      const leafMap = cacheObj[keys[0]] as Map<string, ICacheEntry<T>>;
      const entry = this._buildCacheEntry(value, options, keys[1]);

      leafMap.set(keys[1], entry);
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

      const parentKeys = keys.slice(0, keys.length - 1);
      const targetKey = keys[keys.length - 1];
      const parent = this._navigateToPrefix(this._cache, parentKeys);

      // Parent must exist and be an ICacheObject — clear() can't reach into a Map's entries.
      if (parent === null || parent instanceof Map) {
        return;
      }

      delete parent[targetKey];
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

      if (!this._config?.persistence?.enabled) {
        return;
      }

      try {
        localStorage.removeItem(this._resolveStorageKey());
      } catch {
        // Ignore — clearing storage is best-effort
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
     * this._ncached.cacheObservable(
     *   this._http.get<IUser[]>('/api/users'),
     *   { ttl: 30000 },
     *   'api', 'users'
     * ).subscribe(users => console.log(users));
     *
     * // With a fallback value on error
     * this._ncached.cacheObservable(
     *   this._http.get<IConfig>('/api/config'),
     *   { ttl: 60000, defaultValue: DEFAULT_CONFIG },
     *   'api', 'config'
     * );
     * ```
     */
    public cacheObservable<T = any>(source: Observable<T>, options: ICacheObservableOptions<T>, ...keys: string[]): Observable<T> {
      // Cache hit: emit the cached value without ever subscribing to the source.
      try {
        return of(this.get<T>(...keys));
      } catch {
        // Not in cache or expired — fall through to fetch.
      }

      // Dedup: if an identical request is already in flight, share its subscription.
      const flightKey = keys.join('::');

      if (this._inflight.has(flightKey)) {
        return this._inflight.get(flightKey)! as Observable<T>;
      }

      // Cache miss: build the shared pipeline, register it, and return it.
      const shared$ = this._buildSourcePipeline<T>(source, options, keys, flightKey);

      this._inflight.set(flightKey, shared$);

      return shared$;
    }

    /**
     * Retrieves a cached value by navigating the hierarchy with the given keys.
     * The last key is used as the Map lookup key; all preceding keys navigate the hierarchy.
     *
     * @param keys - Navigation keys (min 2). All but the last navigate; the last is the Map entry key.
     * @returns The cached value of type T
     * @throws {NcachedServiceErrors.InsufficientsKeysProvidedError} If fewer than two keys are provided
     * @throws {NcachedServiceErrors.KeyNotFound} If a navigation key does not exist
     * @throws {NcachedServiceErrors.ValueNotFound} If the entry is missing or has expired
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
     * Checks whether a cache entry exists at the given key path and is not expired.
     * Pure read — does not delete expired entries it encounters (use get() if you want
     * lazy cleanup as a side effect). Never throws; returns false on any miss or
     * malformed call.
     *
     * @param keys - Navigation keys (min 2)
     * @returns true if a non-expired entry exists at the path, false otherwise
     *
     * @example
     * ```typescript
     * cache.set('Ada', 'users', 'currentName');
     * cache.has('users', 'currentName'); // true
     * cache.has('users', 'missing');     // false
     * cache.has('only-one-key');         // false (min 2 keys)
     * ```
     */
    public has(...keys: string[]): boolean {
      if (keys.length < 2) {
        return false;
      }

      try {
        const map = this._findMap<ICacheEntry<any>>(this._cache, ...keys.slice(0, keys.length - 1));
        const mapKey = keys[keys.length - 1];

        if (!map.has(mapKey)) {
          return false;
        }

        const entry = map.get(mapKey)!;

        return !this._isExpired(entry);
      } catch {
        return false;
      }
    }

    /**
     * Lists every complete key path under the given prefix.
     * Each returned path is the full key chain (prefix + leaf), suitable for use with
     * get/set/remove. Expired entries are skipped. Returns an empty array when the
     * prefix does not exist.
     *
     * Pass no arguments to list every path in the cache.
     *
     * @param prefix - Optional namespace prefix to scope the listing
     * @returns Array of complete key paths
     *
     * @example
     * ```typescript
     * cache.set('Ada', 'users', 'byOrg', 'org-1', 'u1');
     * cache.set('Alan', 'users', 'byOrg', 'org-1', 'u2');
     * cache.set('Bob', 'users', 'byOrg', 'org-2', 'u1');
     *
     * cache.keys('users', 'byOrg', 'org-1');
     * // [['users', 'byOrg', 'org-1', 'u1'], ['users', 'byOrg', 'org-1', 'u2']]
     *
     * cache.keys(); // every path in the cache
     * ```
     */
    public keys(...prefix: string[]): string[][] {
      const node = this._navigateToPrefix(this._cache, prefix);

      if (node === null) {
        return [];
      }

      const paths: string[][] = [];
      this._collectKeyPaths(node, [...prefix], paths);
      return paths;
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

      const parentKeys = keys.slice(0, keys.length - 1);
      const mapKey = keys[keys.length - 1];
      const parent = this._navigateToPrefix(this._cache, parentKeys);

      // Parent must resolve to a Map — anything else (missing path or namespace node) is a no-op.
      if (!(parent instanceof Map)) {
        return;
      }

      parent.delete(mapKey);
    }

    /**
     * Stores a value in the cache at the location determined by the given keys.
     * An optional ISetOptions object can be passed as the last argument to configure TTL.
     * The value is internally wrapped in an ICacheEntry with expiration metadata.
     *
     * @param value - The value to cache
     * @param args - String keys (min 2) optionally followed by an ISetOptions object
     * @returns void
     * @throws {NcachedServiceErrors.InsufficientsKeysProvidedError} If fewer than 2 string keys are provided
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
        throw new NcachedServiceErrors.InsufficientsKeysProvidedError();
      }

      this._setInCache<T>(this._cache, value, options, ...keys);
    }

    /**
     * Returns the total number of non-expired entries across the entire cache.
     * Pure read — does not delete the expired entries it skips during traversal.
     *
     * @returns The count of currently-valid entries
     *
     * @example
     * ```typescript
     * cache.set('a', 'mod', 'k1');
     * cache.set('b', 'mod', 'k2');
     * cache.set('c', 'other', 'k1', 'k2');
     * cache.size(); // 3
     * ```
     */
    public size(): number {
      return this._countEntries(this._cache);
    }
}
