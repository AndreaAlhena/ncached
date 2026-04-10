import { Injectable } from '@angular/core';
import { ICacheEntry } from '../interfaces/cache-entry.interface';
import { ICacheObject } from '../interfaces/cache-object.interface';
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

    constructor() {}
  
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
