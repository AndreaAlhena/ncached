import { Injectable } from '@angular/core';
import { ICacheObject } from '../interfaces/cache-object.interface';
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
     * Recursively search for a value in the cache accordingly to the given keys
     *
     * @param {string[]} keys An array of strings to be used for searching the Map instance
     * @returns {T} If a Map is found, the element of type T is taken from it and returned
     * @throws {CacheServiceErrors.InsufficientsKeysProvidedError} If less than two keys are provided, this error is thrown
     * @throws {CacheServiceErrors.ValueNotFound} If the lookup key is not found into the Map, this error is thrown
     */
    private _findInCache<T = any>(...keys: string[]): T {
      // At least two keys (module name / map key) should be provided
      if (keys.length < 2) {
        throw new CacheServiceErrors.InsufficientsKeysProvidedError();
      }
  
      const map = this._findMap(this._cache, ...keys.slice(0, keys.length - 1));
      const mapKey = keys[keys.length - 1]; // Last key is the map key
  
      if (!map.has(mapKey)) {
        throw new CacheServiceErrors.ValueNotFound(mapKey);
      }
  
      return map.get(mapKey);
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
  
      return this._findMap(obj as ICacheObject, ...keys.slice(1, keys.length - 1));
    }
  
    /**
     * Recursively search for the Map object accordingly to the given keys and set the value at the given (last) key in the Map
     * If no Map has been found at the right spot, it is created and the value is set accordingly
     *
     * @param {ICacheObject} cacheObj The cache object. At the beginning, provide the _cache instance of this class
     * @param {T = any} value Value to be set in the Map at the given key
     * @param {string[]} keys An array of strings to be used for searching the Map instance and setting the Map value at the given (last) key
     * @returns {ICacheObject | undefined} ICacheObject if is recursively looking for the right spot. undefined if the value has been set in the Map
     */
    private _setInCache<T = any>(cacheObj: ICacheObject, value: T, ...keys: string[]): ICacheObject | undefined {
      if (keys.length > 2) {
        return this._setInCache(cacheObj[keys[0]] as ICacheObject, value, ...keys.slice(1, keys.length - 1));
      }
  
      if (!(this._cache[keys[0]] instanceof Map)) {
        this._cache[keys[0]] = new Map();
      }
  
      (this._cache[keys[0]] as Map<string, T>).set(keys[1], value);
  
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
     * @param {T = any} value The value to be set in the cache
     * @param {string[]} keys An array of strings to be used for searching the Map instance and setting the value at the given (last) key
     * @returns {void}
     */
    public set<T = any>(value: T, ...keys: string[]): void {
      this._setInCache(this._cache, value, ...keys);
    }
}
