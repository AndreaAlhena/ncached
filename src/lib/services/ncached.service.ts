import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { catchError, finalize, shareReplay, tap } from 'rxjs/operators';
import { ICacheEntry } from '../interfaces/cache-entry.interface';
import { ICacheObject } from '../interfaces/cache-object.interface';
import { ICacheObservableOptions } from '../interfaces/cache-observable-options.interface';
import { ISetOptions } from '../interfaces/set-options.interface';
import { CacheServiceErrors } from '../namespaces/cache-service-errors.namespace';

@Injectable({
  providedIn: 'root'
})
export class NcachedService {

    /**
   * An object that contains multiple Map instances
   * Using multiple maps allows to organize cached data into modules / services
   *
   * @type {ICacheObject}
   */
    private _cache: ICacheObject = {};

    /**
     * Map of in-flight observables keyed by serialized cache keys.
     * Used for request deduplication.
     */
    private _inflight: Map<string, Observable<any>> = new Map();

    constructor() {}
  
    /**
     * Deserializes a JSON string into an ICacheObject, reconstructing Maps.
     * Discards expired entries during reconstruction.
     *
     * @param json - JSON string from _serialize()
     * @returns Reconstructed ICacheObject
     */
    private _deserialize(json: string): ICacheObject {
      const parsed = JSON.parse(json);
      return this._restoreMaps(parsed);
    }

    /**
     * Recursively search for a value in the cache accordingly to the given keys.
     * Unwraps the ICacheEntry and checks TTL expiration.
     *
     * @param keys - Navigation keys (min 2). All but the last navigate the hierarchy; the last is the Map key.
     * @returns The cached value of type T
     * @throws {CacheServiceErrors.InsufficientsKeysProvidedError} If less than two keys are provided
     * @throws {CacheServiceErrors.ValueNotFound} If the key is missing or the entry has expired
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
     * Recursively search for the Map object accordingly to the given keys
     *
     * @param {ICacheObject} cacheObj The cache object. At the beginning, provide the _cache instance of this class
     * @param {string[]} keys An array of strings to be used for searching the Map instance
     * @returns {Map<string, T> | ICacheObject} If a Map is found, it is returned. Otherwise, the nested ICacheObject is given (in this case, a recursive call is applied)
     * @throws {CacheServiceErrors.KeyNotFound} If the lookup key is not found into the ICacheObject, this error is thrown
     * @throws {CacheServiceErrors.MapNotFound} If the lookup key is not a Map instance
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
     * Parses the variadic arguments of set() to separate keys from options.
     * If the last argument is an object, it is treated as ISetOptions.
     *
     * @param args - The mixed array of string keys and optional ISetOptions
     * @returns Parsed keys and options
     */
    private _parseSetArgs(args: Array<string | ISetOptions>): { keys: string[]; options: ISetOptions | undefined } {
      const lastArg = args[args.length - 1];

      return typeof lastArg === 'object' && lastArg !== null
        ? { keys: args.slice(0, -1) as string[], options: lastArg as ISetOptions }
        : { keys: args as string[], options: undefined };
    }

    /**
     * Recursively restores Maps from the serialized format.
     * Filters out expired entries based on their expiresAt timestamp.
     *
     * @param obj - Parsed JSON object
     * @returns ICacheObject with Maps restored
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
     */
    public clearAll(): void {
      this._cache = {};
    }

    /**
     * Caches the result of an Observable source using the given keys.
     * Returns the cached value immediately on cache hit.
     * On cache miss, subscribes to source, caches the result, and emits it.
     * Concurrent calls with the same keys share a single subscription (deduplication).
     *
     * @param source - The Observable to cache (typically an HTTP call)
     * @param options - Configuration: ttl, defaultValue
     * @param keys - Cache keys (same rules as get/set)
     * @returns Observable that emits the cached or fetched value
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
     * Search for the value in the Map found at the given key(s). The last key is the key used for getting the value from the Map instance
     *
     * @param {string[]} keys An array of strings to be used for searching the Map instance and getting the value at the given (last) key
     * @returns {T = any} The value in the cache object
     */
    public get<T = any>(...keys: string[]): T {
      return this._findInCache<T>(...keys) as T;
    }
  
    /**
     * Retrieves a cached value, returning a default if the key is missing or expired.
     * Unlike get(), this method never throws for missing/expired entries.
     *
     * @param defaultValue - Value to return if the cache entry is missing or expired
     * @param keys - Navigation keys (same rules as get())
     * @returns The cached value if found and not expired, otherwise defaultValue
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
     *
     * @param value - The value to cache
     * @param args - String keys (min 2) optionally followed by an ISetOptions object
     */
    public set<T = any>(value: T, ...args: Array<string | ISetOptions>): void {
      const { keys, options } = this._parseSetArgs(args);

      if (keys.length < 2) {
        throw new CacheServiceErrors.InsufficientsKeysProvidedError();
      }

      this._setInCache(this._cache, value, options, ...keys);
    }
}
