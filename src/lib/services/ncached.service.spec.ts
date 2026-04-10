import { TestBed } from '@angular/core/testing';

import { NcachedService } from './ncached.service';
import { CacheServiceErrors } from '../namespaces/cache-service-errors.namespace';

describe('NcachedService', () => {
  let service: NcachedService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(NcachedService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('[_findInCache method] should throw an error if less than two keys are provided', () => {
    expect(() => (service as any)._findInCache('key')).toThrowError(CacheServiceErrors.InsufficientsKeysProvidedError);
  });

  it('[_findInCache method] should throw an error if the map key is not found', () => {
    (service as any)._cache = { parent: new Map() };
    expect(() => (service as any)._findInCache('parent', 'child')).toThrowError(CacheServiceErrors.ValueNotFound, 'A value has not been found in the Map for the given child key');
  });

  it('[_findMap method] should throw an error if the lookup key is not found in ICacheObject', () => {
    expect(() => (service as any)._findMap({}, 'key')).toThrowError(CacheServiceErrors.KeyNotFound, `The key key doesn't exist in the cache object`);
  });

  it('[_findMap method] should throw an error if the lookup key is not a Map instance', () => {
    expect(() => (service as any)._findMap({key: null}, 'key')).toThrowError(CacheServiceErrors.MapNotFound, `A map has not been found in the cache object for the given key key`);
  });
  
  it('[get / set method] should set a value and return a key from an existing map (2 keys)', () => {
    service.set('value', 'parent', 'child');
    expect(service.get('parent', 'child')).toEqual('value');
  });

  it('[get / set method] should set a value and return a key from an existing map (3 keys)', () => {
    service.set('value', 'root', 'parent', 'child');
    expect(service.get('root', 'parent', 'child')).toEqual('value');
  });

  it('[get / set method] should set a value and return a key from an existing map (4 keys)', () => {
    service.set('deep', 'a', 'b', 'c', 'd');
    expect(service.get('a', 'b', 'c', 'd')).toEqual('deep');
  });

  it('[get / set method] should keep independent namespaces isolated at 3+ key depth', () => {
    service.set('val1', 'ns1', 'group', 'key');
    service.set('val2', 'ns2', 'group', 'key');
    expect(service.get('ns1', 'group', 'key')).toEqual('val1');
    expect(service.get('ns2', 'group', 'key')).toEqual('val2');
  });

  it('[set method] should overwrite an existing value at 3+ key depth', () => {
    service.set('old', 'mod', 'sub', 'prop');
    service.set('new', 'mod', 'sub', 'prop');
    expect(service.get('mod', 'sub', 'prop')).toEqual('new');
  });

  it('[get method] should throw an error if less than two keys are provided', () => {
    expect(() => service.get('key')).toThrow(new CacheServiceErrors.InsufficientsKeysProvidedError());
  });

  it('[get method] should throw an error if the lookup key is not found into the Map', () => {
    expect(() => service.get('key1', 'key2')).toThrow(new CacheServiceErrors.KeyNotFound('key1'));
  });

  it('[set method] should accept an ISetOptions object as the last argument', () => {
    service.set('value', 'mod', 'key', { ttl: 60000 });
    expect(service.get('mod', 'key')).toEqual('value');
  });

  it('[set method] should store an ICacheEntry with expiresAt when ttl is provided', () => {
    const before = Date.now();
    service.set('value', 'mod', 'key', { ttl: 5000 });
    const entry = ((service as any)._cache['mod'] as Map<string, any>).get('key');
    expect(entry.value).toEqual('value');
    expect(entry.expiresAt).toBeGreaterThanOrEqual(before + 5000);
    expect(entry.expiresAt).toBeLessThanOrEqual(Date.now() + 5000);
  });

  it('[set method] should store an ICacheEntry with null expiresAt when no ttl', () => {
    service.set('value', 'mod', 'key');
    const entry = ((service as any)._cache['mod'] as Map<string, any>).get('key');
    expect(entry.value).toEqual('value');
    expect(entry.expiresAt).toBeNull();
  });

  it('[get method] should return the unwrapped value from ICacheEntry', () => {
    service.set('hello', 'mod', 'key');
    expect(service.get('mod', 'key')).toEqual('hello');
  });

  it('[get method] should throw ValueNotFound when entry is expired', () => {
    service.set('value', 'mod', 'key', { ttl: 1 });
    const map = (service as any)._cache['mod'] as Map<string, any>;
    const entry = map.get('key');
    entry.expiresAt = Date.now() - 1000;
    expect(() => service.get('mod', 'key')).toThrowError(CacheServiceErrors.ValueNotFound);
  });

  it('[get method] should remove expired entries from the map on access', () => {
    service.set('value', 'mod', 'key', { ttl: 1 });
    const map = (service as any)._cache['mod'] as Map<string, any>;
    const entry = map.get('key');
    entry.expiresAt = Date.now() - 1000;
    try { service.get('mod', 'key'); } catch {}
    expect(map.has('key')).toBeFalse();
  });

  it('[get method] should return value when entry has not expired', () => {
    service.set('value', 'mod', 'key', { ttl: 60000 });
    expect(service.get('mod', 'key')).toEqual('value');
  });

  it('[set method] should handle ttl: 0 as immediate expiration', () => {
    service.set('value', 'mod', 'key', { ttl: 0 });
    const entry = ((service as any)._cache['mod'] as Map<string, any>).get('key');
    expect(entry.expiresAt).not.toBeNull();
  });

  it('[set method] should throw InsufficientsKeysProvidedError when fewer than 2 keys after option parsing', () => {
    expect(() => service.set('value', 'onlyOne', { ttl: 5000 })).toThrow(new CacheServiceErrors.InsufficientsKeysProvidedError());
  });

  it('[set method] should work with 3+ keys and TTL option', () => {
    service.set('deep', 'root', 'child', 'key', { ttl: 60000 });
    expect(service.get('root', 'child', 'key')).toEqual('deep');
  });

  it('[getOrDefault method] should return cached value when key exists', () => {
    service.set('cached', 'mod', 'key');
    expect(service.getOrDefault('fallback', 'mod', 'key')).toEqual('cached');
  });

  it('[getOrDefault method] should return defaultValue when key is not found', () => {
    expect(service.getOrDefault('fallback', 'mod', 'key')).toEqual('fallback');
  });

  it('[getOrDefault method] should return defaultValue when entry is expired', () => {
    service.set('value', 'mod', 'key', { ttl: 1 });
    const map = (service as any)._cache['mod'] as Map<string, any>;
    map.get('key').expiresAt = Date.now() - 1000;
    expect(service.getOrDefault('fallback', 'mod', 'key')).toEqual('fallback');
  });

  describe('invalidation', () => {
    it('[remove method] should remove a specific cache entry', () => {
      service.set('val', 'mod', 'key1');
      service.set('val2', 'mod', 'key2');
      service.remove('mod', 'key1');
      expect(() => service.get('mod', 'key1')).toThrowError(CacheServiceErrors.ValueNotFound);
      expect(service.get('mod', 'key2')).toEqual('val2');
    });

    it('[remove method] should be a no-op when the path does not exist', () => {
      expect(() => service.remove('nonexistent', 'key')).not.toThrow();
    });

    it('[clear method] should clear an entire map layer', () => {
      service.set('a', 'mod', 'key1');
      service.set('b', 'mod', 'key2');
      service.clear('mod');
      expect(() => service.get('mod', 'key1')).toThrowError(CacheServiceErrors.KeyNotFound);
    });

    it('[clear method] should clear a nested subtree', () => {
      service.set('a', 'root', 'child', 'key1');
      service.clear('root');
      expect(() => service.get('root', 'child', 'key1')).toThrowError(CacheServiceErrors.KeyNotFound);
    });

    it('[clear method] should be a no-op when the path does not exist', () => {
      expect(() => service.clear('nonexistent')).not.toThrow();
    });

    it('[clearAll method] should wipe the entire cache', () => {
      service.set('a', 'mod1', 'key');
      service.set('b', 'mod2', 'key');
      service.clearAll();
      expect(() => service.get('mod1', 'key')).toThrowError(CacheServiceErrors.KeyNotFound);
      expect(() => service.get('mod2', 'key')).toThrowError(CacheServiceErrors.KeyNotFound);
    });
  });
});
