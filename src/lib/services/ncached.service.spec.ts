import { TestBed } from '@angular/core/testing';

import { NcachedService } from './ncached.service';
import { CacheServiceErrors } from '../namespaces/cache-service-errors.namespace';

describe('NcachedService', () => {
  let service: NcachedService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = new NcachedService();
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
    expect(() => (service as any)._findMap({}, 'key', 'key1')).toThrowError(CacheServiceErrors.KeyNotFound, `The key key doesn't exist in the cache object`);
  });

  it('[_findMap method] should throw an error if the lookup key is not a Map instance', () => {
    expect(() => (service as any)._findMap({key: null}, 'key')).toThrowError(CacheServiceErrors.MapNotFound, `A map has not been found in the cache object for the given key key`);
  });
  
  it('[get / set method] should set a value and return a key from an existing map (2 keys)', () => {
    service.set('value', 'parent', 'child');
    expect(service.get('parent', 'child')).toEqual('value');
  });

  it('[get / set method] should set a value and return the same from an existing map (3 keys)', () => {
    service.set('value', 'root', 'parent', 'child');
    expect(service.get('root', 'parent', 'child')).toEqual('value');
  });

  it('[get method] should throw an error if less than two keys are provided', () => {
    expect(() => service.get('key')).toThrow(new CacheServiceErrors.InsufficientsKeysProvidedError());
  });

  it('[get method] should throw an error if the lookup key is not found into the Map', () => {
    service.set('value', 'key1', 'key9');
    expect(() => service.get('key1', 'key2')).toThrowError(CacheServiceErrors.ValueNotFound, 'A value has not been found in the Map for the given key2 key');
  });
});
