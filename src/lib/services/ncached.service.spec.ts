import { TestBed } from '@angular/core/testing';
import { of, throwError, Subject, Observable } from 'rxjs';

import { NcachedService } from './ncached.service';
import { NcachedServiceErrors } from '../namespaces/ncached-service-errors.namespace';
import { NCACHED_CONFIG } from '../tokens/ncached-config.token';
import { INcachedConfig } from '../interfaces/ncached-config.interface';
import { NoopCompressor } from '../compressors/noop.compressor';

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
    expect(() => (service as any)._findInCache('key')).toThrowError(NcachedServiceErrors.InsufficientsKeysProvidedError);
  });

  it('[_findInCache method] should throw an error if the map key is not found', () => {
    (service as any)._cache = { parent: new Map() };
    expect(() => (service as any)._findInCache('parent', 'child')).toThrowError(NcachedServiceErrors.ValueNotFound, 'A value has not been found in the Map for the given child key');
  });

  it('[_findMap method] should throw an error if the lookup key is not found in ICacheObject', () => {
    expect(() => (service as any)._findMap({}, 'key', 'key1')).toThrowError(NcachedServiceErrors.KeyNotFound, `The key key doesn't exist in the cache object`);
  });

  it('[_findMap method] should throw an error if the lookup key is not a Map instance', () => {
    expect(() => (service as any)._findMap({key: null}, 'key')).toThrowError(NcachedServiceErrors.MapNotFound, `A map has not been found in the cache object for the given key key`);
  });
  
  it('[get method] should retrieve a value from an existing key', () => {
    service['_cache'] = {key1: new Map<string, any>()};
    (service['_cache']['key1'] as Map<string, any>).set('key2', { value: 'value', expiresAt: null });
    expect(service.get('key1', 'key2')).toEqual('value');
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
    expect(() => service.get('key')).toThrow(new NcachedServiceErrors.InsufficientsKeysProvidedError());
  });

  it('[get method] should throw an error if the lookup key is not found into the Map', () => {
    service['_cache'] = {key1: new Map<string, any>()};
    (service['_cache']['key1'] as Map<string, any>).set('key9', { value: 'value', expiresAt: null });
    expect(() => service.get('key1', 'key2')).toThrowError(NcachedServiceErrors.ValueNotFound, 'A value has not been found in the Map for the given key2 key');
  });

  it('[set method] should set a value in a new map (2 keys)', () => {
    service.set('value', 'parent', 'child');
    expect((service['_cache'] as {parent: Map<string, any>}).parent.get('child').value).toEqual('value');
  });

  it('[set method] should set a value in a new map (3 keys)', () => {
    service.set('value', 'root', 'parent', 'child');
    expect((service['_cache']['root'] as {parent: Map<string, any>}).parent.get('child').value).toEqual('value');
  });

  it('[set method] should throw an error if less than two keys are provided', () => {
    expect(() => service.set('value', 'child')).toThrow(new NcachedServiceErrors.InsufficientsKeysProvidedError());
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
    expect(() => service.get('mod', 'key')).toThrowError(NcachedServiceErrors.ValueNotFound);
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
    expect(() => service.set('value', 'onlyOne', { ttl: 5000 })).toThrow(new NcachedServiceErrors.InsufficientsKeysProvidedError());
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
      expect(() => service.get('mod', 'key1')).toThrowError(NcachedServiceErrors.ValueNotFound);
      expect(service.get('mod', 'key2')).toEqual('val2');
    });

    it('[remove method] should be a no-op when the path does not exist', () => {
      expect(() => service.remove('nonexistent', 'key')).not.toThrow();
    });

    it('[clear method] should clear an entire map layer', () => {
      service.set('a', 'mod', 'key1');
      service.set('b', 'mod', 'key2');
      service.clear('mod');
      expect(() => service.get('mod', 'key1')).toThrowError(NcachedServiceErrors.KeyNotFound);
    });

    it('[clear method] should clear a nested subtree', () => {
      service.set('a', 'root', 'child', 'key1');
      service.clear('root');
      expect(() => service.get('root', 'child', 'key1')).toThrowError(NcachedServiceErrors.KeyNotFound);
    });

    it('[clear method] should be a no-op when the path does not exist', () => {
      expect(() => service.clear('nonexistent')).not.toThrow();
    });

    it('[clearAll method] should wipe the entire cache', () => {
      service.set('a', 'mod1', 'key');
      service.set('b', 'mod2', 'key');
      service.clearAll();
      expect(() => service.get('mod1', 'key')).toThrowError(NcachedServiceErrors.KeyNotFound);
      expect(() => service.get('mod2', 'key')).toThrowError(NcachedServiceErrors.KeyNotFound);
    });
  });

  describe('cacheObservable', () => {
    it('should return cached value immediately on cache hit', (done) => {
      service.set('cached', 'mod', 'key');
      const source$ = of('fresh');
      service.cacheObservable(source$, {}, 'mod', 'key').subscribe(value => {
        expect(value).toEqual('cached');
        done();
      });
    });

    it('should subscribe to source on cache miss and store result', (done) => {
      const source$ = of('fetched');
      service.cacheObservable(source$, {}, 'mod', 'key').subscribe(value => {
        expect(value).toEqual('fetched');
        expect(service.get('mod', 'key')).toEqual('fetched');
        done();
      });
    });

    it('should store result with TTL when ttl option is provided', (done) => {
      const source$ = of('fetched');
      service.cacheObservable(source$, { ttl: 5000 }, 'mod', 'key').subscribe(() => {
        const map = (service as any)._cache['mod'] as Map<string, any>;
        const entry = map.get('key');
        expect(entry.expiresAt).not.toBeNull();
        done();
      });
    });

    it('should emit defaultValue when source errors and defaultValue is provided', (done) => {
      const source$ = throwError(() => new Error('network'));
      service.cacheObservable(source$, { defaultValue: 'fallback' }, 'mod', 'key').subscribe(value => {
        expect(value).toEqual('fallback');
        done();
      });
    });

    it('should rethrow error when source errors and no defaultValue', (done) => {
      const source$ = throwError(() => new Error('network'));
      service.cacheObservable(source$, {}, 'mod', 'key').subscribe({
        error: (err) => {
          expect(err.message).toEqual('network');
          done();
        }
      });
    });

    it('should not subscribe to source when cached value exists and is not expired', () => {
      service.set('cached', 'mod', 'key');
      let subscribed = false;
      const source$ = new Observable<string>(subscriber => {
        subscribed = true;
        subscriber.next('fresh');
        subscriber.complete();
      });
      service.cacheObservable(source$, {}, 'mod', 'key').subscribe();
      expect(subscribed).toBeFalse();
    });

    it('should deduplicate concurrent calls with the same keys', () => {
      let subscribeCount = 0;
      const source$ = new Observable<string>(subscriber => {
        subscribeCount++;
        subscriber.next('result');
        subscriber.complete();
      });

      service.cacheObservable(source$, {}, 'mod', 'key').subscribe();
      service.cacheObservable(source$, {}, 'mod', 'key').subscribe();
      service.cacheObservable(source$, {}, 'mod', 'key').subscribe();

      expect(subscribeCount).toBe(1);
    });

    it('should not deduplicate calls with different keys', () => {
      let subscribeCount = 0;
      const source$ = new Observable<string>(subscriber => {
        subscribeCount++;
        subscriber.next('result');
        subscriber.complete();
      });

      service.cacheObservable(source$, {}, 'mod', 'key1').subscribe();
      service.cacheObservable(source$, {}, 'mod', 'key2').subscribe();

      expect(subscribeCount).toBe(2);
    });

    it('should clean up inflight entry after source completes', () => {
      const subject = new Subject<string>();
      service.cacheObservable(subject.asObservable(), {}, 'mod', 'key').subscribe();
      expect((service as any)._inflight.size).toBe(1);
      subject.next('done');
      subject.complete();
      expect((service as any)._inflight.size).toBe(0);
    });
  });

  describe('serialization', () => {
    it('[_serialize method] should convert cache Maps to JSON-safe format', () => {
      service.set('value', 'mod', 'key');
      const json = (service as any)._serialize();
      const parsed = JSON.parse(json);
      expect(parsed.mod.__mapEntries).toBeDefined();
      expect(parsed.mod.__mapEntries[0][0]).toEqual('key');
      expect(parsed.mod.__mapEntries[0][1].value).toEqual('value');
    });

    it('[_deserialize method] should reconstruct Maps from JSON', () => {
      service.set('value', 'mod', 'key');
      const json = (service as any)._serialize();
      const restored = (service as any)._deserialize(json);
      expect(restored['mod'] instanceof Map).toBeTrue();
      expect(restored['mod'].get('key').value).toEqual('value');
    });

    it('[_deserialize/_serialize] should round-trip nested caches', () => {
      service.set('deep', 'root', 'child', 'key');
      const json = (service as any)._serialize();
      const restored = (service as any)._deserialize(json);
      expect(restored['root']['child'] instanceof Map).toBeTrue();
      expect(restored['root']['child'].get('key').value).toEqual('deep');
    });

    it('[_deserialize method] should discard expired entries during deserialization', () => {
      service.set('expired', 'mod', 'key', { ttl: 1 });
      const map = (service as any)._cache['mod'] as Map<string, any>;
      map.get('key').expiresAt = Date.now() - 1000;
      const json = (service as any)._serialize();
      const restored = (service as any)._deserialize(json);
      expect(restored['mod'].has('key')).toBeFalse();
    });
  });
});

describe('NcachedService (persistence)', () => {
  const STORAGE_KEY = 'ncached_test';

  afterEach(() => {
    localStorage.removeItem(STORAGE_KEY);
  });

  function createServiceWithPersistence(storageContent?: string): NcachedService {
    if (storageContent) {
      localStorage.setItem(STORAGE_KEY, storageContent);
    }

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: NCACHED_CONFIG,
          useValue: {
            persistence: {
              enabled: true,
              storageKey: STORAGE_KEY,
              compressor: new NoopCompressor()
            }
          } as INcachedConfig
        }
      ]
    });

    return TestBed.inject(NcachedService);
  }

  it('should hydrate cache from localStorage on construction', () => {
    const data = JSON.stringify({
      mod: { __mapEntries: [['key', { value: 'hydrated', expiresAt: null }]] }
    });
    const svc = createServiceWithPersistence(data);
    expect(svc.get('mod', 'key')).toEqual('hydrated');
  });

  it('should discard expired entries during hydration', () => {
    const data = JSON.stringify({
      mod: { __mapEntries: [['key', { value: 'old', expiresAt: Date.now() - 1000 }]] }
    });
    const svc = createServiceWithPersistence(data);
    expect(() => svc.get('mod', 'key')).toThrowError();
  });

  it('should start with empty cache if localStorage is empty', () => {
    const svc = createServiceWithPersistence();
    expect(() => svc.get('mod', 'key')).toThrowError();
  });

  it('should start with empty cache if localStorage contains invalid JSON', () => {
    const svc = createServiceWithPersistence('not-json{{{');
    expect(() => svc.get('mod', 'key')).toThrowError();
  });

  it('should register a beforeunload listener when persistence is enabled', () => {
    spyOn(window, 'addEventListener');
    createServiceWithPersistence();
    expect(window.addEventListener).toHaveBeenCalledWith('beforeunload', jasmine.any(Function));
  });

  it('should persist cache to localStorage on beforeunload', () => {
    spyOn(window, 'addEventListener').and.callFake(((event: string, handler: EventListenerOrEventListenerObject) => {
      if (event === 'beforeunload') {
        (window as any).__beforeUnloadHandler = handler;
      }
    }) as any);

    const svc = createServiceWithPersistence();
    svc.set('data', 'mod', 'key');

    (window as any).__beforeUnloadHandler();

    const stored = localStorage.getItem(STORAGE_KEY);
    expect(stored).toBeTruthy();
    const parsed = JSON.parse(stored!);
    expect(parsed.mod.__mapEntries[0][1].value).toEqual('data');

    delete (window as any).__beforeUnloadHandler;
  });

  it('should handle QuotaExceededError gracefully on persist', () => {
    spyOn(window, 'addEventListener').and.callFake(((event: string, handler: EventListenerOrEventListenerObject) => {
      if (event === 'beforeunload') {
        (window as any).__beforeUnloadHandler = handler;
      }
    }) as any);
    spyOn(localStorage, 'setItem').and.throwError(new DOMException('quota', 'QuotaExceededError'));
    spyOn(console, 'warn');

    const svc = createServiceWithPersistence();
    svc.set('data', 'mod', 'key');

    expect(() => (window as any).__beforeUnloadHandler()).not.toThrow();
    expect(console.warn).toHaveBeenCalled();

    delete (window as any).__beforeUnloadHandler;
  });

  it('[clearAll method] should also remove the localStorage entry when persistence is enabled', () => {
    localStorage.setItem(STORAGE_KEY, 'some-data');
    const svc = createServiceWithPersistence();
    svc.set('data', 'mod', 'key');
    svc.clearAll();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});

describe('NcachedService (immutability)', () => {
  let service: NcachedService;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    service = TestBed.inject(NcachedService);
  });

  it('[set method] should not be affected by post-set mutation of the source object', () => {
    const source = { name: 'Ada', tags: ['a', 'b'] };
    service.set(source, 'users', 'me');
    source.name = 'mutated';
    source.tags.push('c');
    expect(service.get<typeof source>('users', 'me')).toEqual({ name: 'Ada', tags: ['a', 'b'] });
  });

  it('[get method] should not let the consumer mutate the cached value via the returned reference', () => {
    service.set({ name: 'Ada', tags: ['a'] }, 'users', 'me');
    const first = service.get<{ name: string; tags: string[] }>('users', 'me');
    first.name = 'mutated';
    first.tags.push('b');
    expect(service.get('users', 'me')).toEqual({ name: 'Ada', tags: ['a'] });
  });

  it('[getOrDefault method] should return a clone, not a live reference', () => {
    service.set({ count: 1 }, 'mod', 'key');
    const first = service.getOrDefault<{ count: number }>({ count: 0 }, 'mod', 'key');
    first.count = 999;
    expect(service.getOrDefault<{ count: number }>({ count: 0 }, 'mod', 'key')).toEqual({ count: 1 });
  });

  it('[cacheObservable method] should emit a clone on cache hit', (done) => {
    service.set({ items: [1, 2] }, 'mod', 'key');
    service.cacheObservable<{ items: number[] }>(of({ items: [99] }), {}, 'mod', 'key').subscribe(value => {
      value.items.push(3);
      expect(service.get('mod', 'key')).toEqual({ items: [1, 2] });
      done();
    });
  });

  it('[set method] should throw UncloneableValueError when value cannot be structured-cloned', () => {
    expect(() => service.set(() => 1, 'mod', 'key'))
      .toThrowError(NcachedServiceErrors.UncloneableValueError);
  });
});
