# ncached Feature Enhancement Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform ncached from a basic hierarchical Map cache into a full-featured in-memory caching library with TTL, Observable integration, request deduplication, invalidation, and optional localStorage persistence.

**Architecture:** The in-memory `ICacheObject` hierarchy stays as the core. Values get wrapped in `ICacheEntry<T>` to support TTL. A persistence layer (off by default) serializes/hydrates the cache to/from localStorage on page lifecycle events. `cacheObservable()` adds RxJS integration with dedup via an in-flight `Map` + `shareReplay`.

**Tech Stack:** Angular 19, TypeScript 5.6, RxJS 7, Jasmine/Karma, lz-string (new dep for optional compression)

**Workspace root:** `C:\Users\andre\Code\ng-workspace`
**Project root:** `C:\Users\andre\Code\ng-workspace\projects\ncached`
**Test command:** `cd /c/Users/andre/Code/ng-workspace && npx ng test ncached --no-watch --browsers=ChromeHeadless`
**Coverage command:** `cd /c/Users/andre/Code/ng-workspace && npx ng test ncached --no-watch --browsers=ChromeHeadless --code-coverage`

**Commit rules:** Commits use the user's git identity only. No `Co-Authored-By` trailers. Add each issue to GH project 11 via `gh project item-add 11 --owner AndreaAlhena --url <issue-url>`.

---

## File Structure

### New files to create

```
src/lib/
  compressors/
    lz-string.compressor.ts          // LzStringCompressor class
    lz-string.compressor.spec.ts     // Tests for LzStringCompressor
    noop.compressor.ts               // NoopCompressor class
    noop.compressor.spec.ts          // Tests for NoopCompressor
  interfaces/
    cache-entry.interface.ts          // ICacheEntry<T>
    cache-observable-options.interface.ts  // ICacheObservableOptions<T>
    compressor.interface.ts           // ICompressor
    ncached-config.interface.ts       // INcachedConfig
    set-options.interface.ts          // ISetOptions
  tokens/
    ncached-config.token.ts           // NCACHED_CONFIG InjectionToken + provideNcachedConfig()
```

### Existing files to modify

```
src/lib/
  interfaces/
    cache-object.interface.ts         // Update Map value type to ICacheEntry
  namespaces/
    cache-service-errors.namespace.ts // Add EntryExpired error class
  services/
    ncached.service.ts                // Core: TTL, invalidation, observable, persistence
    ncached.service.spec.ts           // All new tests
src/
  public-api.ts                       // Export all new symbols
package.json                          // Version bump, add lz-string dep, rxjs peer dep
```

---

## Task 1: Version bump to 0.0.2 for prior bugfix

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Bump version**

In `projects/ncached/package.json`, change `"version": "0.0.1"` to `"version": "0.0.2"`.

- [ ] **Step 2: Commit**

```bash
git add src/ package.json
git commit -m "chore: bump version to 0.0.2 for recursive nesting bugfix"
```

---

## Task 2: ICacheEntry and ISetOptions interfaces

**Files:**
- Create: `src/lib/interfaces/cache-entry.interface.ts`
- Create: `src/lib/interfaces/set-options.interface.ts`

- [ ] **Step 1: Create ICacheEntry interface**

File: `src/lib/interfaces/cache-entry.interface.ts`

```typescript
/**
 * Wraps a cached value with expiration metadata.
 *
 * @template T The type of the cached value
 */
export interface ICacheEntry<T> {
  /** The cached value. */
  value: T;
  /** Epoch timestamp (ms) when this entry expires, or null for no expiration. */
  expiresAt: number | null;
}
```

- [ ] **Step 2: Create ISetOptions interface**

File: `src/lib/interfaces/set-options.interface.ts`

```typescript
/**
 * Optional configuration for cache set operations.
 */
export interface ISetOptions {
  /** Time-to-live in milliseconds. If omitted, the entry never expires. */
  ttl?: number;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/interfaces/cache-entry.interface.ts src/lib/interfaces/set-options.interface.ts
git commit -m "feat: add ICacheEntry and ISetOptions interfaces"
```

---

## Task 3: TTL support on set()

This task wraps stored values in `ICacheEntry` and modifies `set()` to accept an optional `ISetOptions` object as the last argument. The signature becomes `set<T>(value: T, ...args: Array<string | ISetOptions>): void`. Internally, if the last element of `args` is an object (not a string), it's parsed as options.

**Files:**
- Modify: `src/lib/services/ncached.service.ts`
- Modify: `src/lib/services/ncached.service.spec.ts`

- [ ] **Step 1: Write failing test for set with TTL**

Add to `ncached.service.spec.ts`, inside the existing `describe('NcachedService', ...)`:

```typescript
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /c/Users/andre/Code/ng-workspace && npx ng test ncached --no-watch --browsers=ChromeHeadless
```

Expected: 3 new tests fail. The first test might pass (set ignores the object), but the ICacheEntry structure tests will fail because set() currently stores raw values, not `{ value, expiresAt }`.

- [ ] **Step 3: Implement TTL on set()**

In `ncached.service.ts`:

1. Add imports at the top:

```typescript
import { ICacheEntry } from '../interfaces/cache-entry.interface';
import { ISetOptions } from '../interfaces/set-options.interface';
```

2. Add a private method `_parseSetArgs` (alphabetically among private methods):

```typescript
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
```

3. Change `set()` signature and body:

```typescript
/**
 * Stores a value in the cache at the location determined by the given keys.
 * An optional ISetOptions object can be passed as the last argument to configure TTL.
 *
 * @param value - The value to cache
 * @param args - String keys (min 2) optionally followed by an ISetOptions object
 */
public set<T = any>(value: T, ...args: Array<string | ISetOptions>): void {
  const { keys, options } = this._parseSetArgs(args);
  this._setInCache(this._cache, value, options, ...keys);
}
```

4. Update `_setInCache` to accept options and wrap in ICacheEntry:

```typescript
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
    expiresAt: options?.ttl ? Date.now() + options.ttl : null
  };

  (cacheObj[keys[0]] as Map<string, ICacheEntry<T>>).set(keys[1], entry);

  return;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /c/Users/andre/Code/ng-workspace && npx ng test ncached --no-watch --browsers=ChromeHeadless
```

Expected: The 3 new TTL tests pass. **Some existing tests will fail** because `get()` still returns the raw `ICacheEntry` wrapper instead of unwrapping `.value`. That's expected — Task 4 fixes `get()`.

- [ ] **Step 5: Commit (tests + implementation together since they're coupled)**

```bash
git add src/lib/services/ncached.service.ts src/lib/services/ncached.service.spec.ts src/lib/interfaces/cache-entry.interface.ts src/lib/interfaces/set-options.interface.ts
git commit -m "feat: wrap cached values in ICacheEntry with TTL support on set()"
```

---

## Task 4: TTL expiration check on get()

Modify `_findInCache` to unwrap `ICacheEntry.value` and check TTL. If expired, delete the entry and throw `ValueNotFound`.

**Files:**
- Modify: `src/lib/services/ncached.service.ts`
- Modify: `src/lib/services/ncached.service.spec.ts`

- [ ] **Step 1: Write failing tests for expiration**

Add to `ncached.service.spec.ts`:

```typescript
it('[get method] should return the unwrapped value from ICacheEntry', () => {
  service.set('hello', 'mod', 'key');
  expect(service.get('mod', 'key')).toEqual('hello');
});

it('[get method] should throw ValueNotFound when entry is expired', () => {
  service.set('value', 'mod', 'key', { ttl: 1 });
  // Fast-forward past expiration
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /c/Users/andre/Code/ng-workspace && npx ng test ncached --no-watch --browsers=ChromeHeadless
```

Expected: Expiration tests fail because `_findInCache` returns the raw ICacheEntry, not `.value`, and doesn't check TTL.

- [ ] **Step 3: Update _findInCache to unwrap ICacheEntry and check TTL**

In `ncached.service.ts`, replace `_findInCache`:

```typescript
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
```

- [ ] **Step 4: Run all tests**

```bash
cd /c/Users/andre/Code/ng-workspace && npx ng test ncached --no-watch --browsers=ChromeHeadless
```

Expected: ALL tests pass (new TTL tests + all existing get/set round-trip tests, since `get()` now unwraps `.value`).

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/ncached.service.ts src/lib/services/ncached.service.spec.ts
git commit -m "feat: add TTL expiration check on get() with automatic entry cleanup"
```

---

## Task 5: getOrDefault()

**Files:**
- Modify: `src/lib/services/ncached.service.ts`
- Modify: `src/lib/services/ncached.service.spec.ts`

- [ ] **Step 1: Write failing tests**

```typescript
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /c/Users/andre/Code/ng-workspace && npx ng test ncached --no-watch --browsers=ChromeHeadless
```

Expected: FAIL — `getOrDefault` is not a function.

- [ ] **Step 3: Implement getOrDefault**

Add to `ncached.service.ts` (alphabetically among public methods, between `get()` and `set()`):

```typescript
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
```

- [ ] **Step 4: Run tests**

```bash
cd /c/Users/andre/Code/ng-workspace && npx ng test ncached --no-watch --browsers=ChromeHeadless
```

Expected: All pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/ncached.service.ts src/lib/services/ncached.service.spec.ts
git commit -m "feat: add getOrDefault() for safe cache access without throws"
```

---

## Task 6: Invalidation API (remove, clear, clearAll)

**Files:**
- Modify: `src/lib/services/ncached.service.ts`
- Modify: `src/lib/services/ncached.service.spec.ts`

- [ ] **Step 1: Write failing tests**

```typescript
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /c/Users/andre/Code/ng-workspace && npx ng test ncached --no-watch --browsers=ChromeHeadless
```

Expected: FAIL — `remove`, `clear`, `clearAll` are not functions.

- [ ] **Step 3: Implement the three methods**

Add to `ncached.service.ts` (alphabetically among public methods):

```typescript
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
```

- [ ] **Step 4: Run tests**

```bash
cd /c/Users/andre/Code/ng-workspace && npx ng test ncached --no-watch --browsers=ChromeHeadless
```

Expected: All pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/ncached.service.ts src/lib/services/ncached.service.spec.ts
git commit -m "feat: add invalidation API — remove(), clear(), clearAll()"
```

---

## Task 7: ICacheObservableOptions interface + cacheObservable()

**Files:**
- Create: `src/lib/interfaces/cache-observable-options.interface.ts`
- Modify: `src/lib/services/ncached.service.ts`
- Modify: `src/lib/services/ncached.service.spec.ts`

- [ ] **Step 1: Create ICacheObservableOptions interface**

File: `src/lib/interfaces/cache-observable-options.interface.ts`

```typescript
/**
 * Configuration for the cacheObservable() method.
 *
 * @template T The type of the Observable value
 */
export interface ICacheObservableOptions<T = unknown> {
  /** Time-to-live in milliseconds for the cached result. Omit for no expiration. */
  ttl?: number;
  /** Fallback value returned if the source errors and no cached value exists. */
  defaultValue?: T;
}
```

- [ ] **Step 2: Write failing tests for cacheObservable**

Add these imports at the top of `ncached.service.spec.ts`:

```typescript
import { of, throwError, Subject, delay } from 'rxjs';
```

Add test block:

```typescript
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
    const source$ = new Subject<string>();
    source$.subscribe(() => { subscribed = true; });
    service.cacheObservable(source$, {}, 'mod', 'key').subscribe();
    expect(subscribed).toBeFalse();
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd /c/Users/andre/Code/ng-workspace && npx ng test ncached --no-watch --browsers=ChromeHeadless
```

Expected: FAIL — `cacheObservable` is not a function.

- [ ] **Step 4: Implement cacheObservable**

Add RxJS imports to `ncached.service.ts`:

```typescript
import { Observable, of, throwError } from 'rxjs';
import { catchError, finalize, shareReplay, tap } from 'rxjs/operators';
```

Add interface import:

```typescript
import { ICacheObservableOptions } from '../interfaces/cache-observable-options.interface';
```

Add private property (alphabetically among private properties):

```typescript
/**
 * Map of in-flight observables keyed by serialized cache keys.
 * Used for request deduplication.
 */
private _inflight: Map<string, Observable<any>> = new Map();
```

Add public method (alphabetically among public methods, after `clearAll` and before `get`):

```typescript
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
      this._setInCache<T>(this._cache, value, options.ttl ? { ttl: options.ttl } : undefined, ...keys);
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
```

- [ ] **Step 5: Run tests**

```bash
cd /c/Users/andre/Code/ng-workspace && npx ng test ncached --no-watch --browsers=ChromeHeadless
```

Expected: All pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/interfaces/cache-observable-options.interface.ts src/lib/services/ncached.service.ts src/lib/services/ncached.service.spec.ts
git commit -m "feat: add cacheObservable() with RxJS integration and defaultValue support"
```

---

## Task 8: Request deduplication tests

The dedup mechanism was implemented in Task 7 (the `_inflight` Map + `shareReplay`). This task adds explicit tests proving it works.

**Files:**
- Modify: `src/lib/services/ncached.service.spec.ts`

- [ ] **Step 1: Write deduplication tests**

Add inside the existing `describe('cacheObservable', ...)`:

```typescript
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
```

Add `Observable` to the rxjs import at the top of the spec:

```typescript
import { of, throwError, Subject, Observable } from 'rxjs';
```

- [ ] **Step 2: Run tests**

```bash
cd /c/Users/andre/Code/ng-workspace && npx ng test ncached --no-watch --browsers=ChromeHeadless
```

Expected: All pass (dedup is already implemented). If any fail, fix the implementation.

- [ ] **Step 3: Commit**

```bash
git add src/lib/services/ncached.service.spec.ts
git commit -m "test: add explicit request deduplication tests for cacheObservable"
```

---

## Task 9: ICompressor interface + NoopCompressor

**Files:**
- Create: `src/lib/interfaces/compressor.interface.ts`
- Create: `src/lib/compressors/noop.compressor.ts`
- Create: `src/lib/compressors/noop.compressor.spec.ts`

- [ ] **Step 1: Create ICompressor interface**

File: `src/lib/interfaces/compressor.interface.ts`

```typescript
/**
 * Compression strategy for the persistence layer.
 * Implementations MUST be synchronous — the persist step runs
 * inside a beforeunload handler which does not support async work.
 */
export interface ICompressor {
  /**
   * Compresses a string for storage.
   *
   * @param data - The string to compress
   * @returns The compressed string
   */
  compress(data: string): string;

  /**
   * Decompresses a previously compressed string.
   *
   * @param data - The compressed string
   * @returns The original string
   */
  decompress(data: string): string;
}
```

- [ ] **Step 2: Write failing tests for NoopCompressor**

File: `src/lib/compressors/noop.compressor.spec.ts`

```typescript
import { NoopCompressor } from './noop.compressor';

describe('NoopCompressor', () => {
  let compressor: NoopCompressor;

  beforeEach(() => {
    compressor = new NoopCompressor();
  });

  it('should return input unchanged on compress', () => {
    expect(compressor.compress('hello world')).toEqual('hello world');
  });

  it('should return input unchanged on decompress', () => {
    expect(compressor.decompress('hello world')).toEqual('hello world');
  });

  it('should handle empty strings', () => {
    expect(compressor.compress('')).toEqual('');
    expect(compressor.decompress('')).toEqual('');
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd /c/Users/andre/Code/ng-workspace && npx ng test ncached --no-watch --browsers=ChromeHeadless
```

Expected: FAIL — Cannot find module `./noop.compressor`.

- [ ] **Step 4: Implement NoopCompressor**

File: `src/lib/compressors/noop.compressor.ts`

```typescript
import { ICompressor } from '../interfaces/compressor.interface';

/**
 * A no-op compressor that returns the input unchanged.
 * This is the default compressor when no compression is configured.
 */
export class NoopCompressor implements ICompressor {
  /**
   * Returns the input string unchanged.
   *
   * @param data - The string to "compress"
   * @returns The same string
   */
  public compress(data: string): string {
    return data;
  }

  /**
   * Returns the input string unchanged.
   *
   * @param data - The string to "decompress"
   * @returns The same string
   */
  public decompress(data: string): string {
    return data;
  }
}
```

- [ ] **Step 5: Run tests**

```bash
cd /c/Users/andre/Code/ng-workspace && npx ng test ncached --no-watch --browsers=ChromeHeadless
```

Expected: All pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/interfaces/compressor.interface.ts src/lib/compressors/noop.compressor.ts src/lib/compressors/noop.compressor.spec.ts
git commit -m "feat: add ICompressor interface and NoopCompressor"
```

---

## Task 10: LzStringCompressor + lz-string dependency

**Files:**
- Modify: `package.json` (library)
- Modify: workspace `package.json` (devDependency for types)
- Create: `src/lib/compressors/lz-string.compressor.ts`
- Create: `src/lib/compressors/lz-string.compressor.spec.ts`

- [ ] **Step 1: Install lz-string**

```bash
cd /c/Users/andre/Code/ng-workspace && npm install lz-string --save
```

Then add `lz-string` to the **library's** `projects/ncached/package.json` dependencies:

```json
"dependencies": {
  "tslib": "^2.3.0",
  "lz-string": "^1.5.0"
}
```

- [ ] **Step 2: Write failing tests**

File: `src/lib/compressors/lz-string.compressor.spec.ts`

```typescript
import { LzStringCompressor } from './lz-string.compressor';

describe('LzStringCompressor', () => {
  let compressor: LzStringCompressor;

  beforeEach(() => {
    compressor = new LzStringCompressor();
  });

  it('should round-trip compress and decompress a string', () => {
    const input = '{"key":"value","nested":{"a":1,"b":2}}';
    const compressed = compressor.compress(input);
    expect(compressor.decompress(compressed)).toEqual(input);
  });

  it('should produce a compressed output different from the input for non-trivial data', () => {
    const input = 'a'.repeat(1000);
    const compressed = compressor.compress(input);
    expect(compressed).not.toEqual(input);
    expect(compressed.length).toBeLessThan(input.length);
  });

  it('should handle empty strings', () => {
    expect(compressor.decompress(compressor.compress(''))).toEqual('');
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd /c/Users/andre/Code/ng-workspace && npx ng test ncached --no-watch --browsers=ChromeHeadless
```

Expected: FAIL — Cannot find module `./lz-string.compressor`.

- [ ] **Step 4: Implement LzStringCompressor**

File: `src/lib/compressors/lz-string.compressor.ts`

```typescript
import LZString from 'lz-string';
import { ICompressor } from '../interfaces/compressor.interface';

/**
 * Compressor using lz-string's UTF-16 encoding, optimized for localStorage.
 * All operations are synchronous (safe for beforeunload handlers).
 */
export class LzStringCompressor implements ICompressor {
  /**
   * Compresses a string using lz-string's compressToUTF16.
   *
   * @param data - The string to compress
   * @returns The compressed UTF-16 string
   */
  public compress(data: string): string {
    return LZString.compressToUTF16(data);
  }

  /**
   * Decompresses a UTF-16 compressed string.
   *
   * @param data - The compressed string
   * @returns The original string
   */
  public decompress(data: string): string {
    return LZString.decompressFromUTF16(data) ?? '';
  }
}
```

Note: If `lz-string` doesn't have a default export, use `import * as LZString from 'lz-string'` instead. Check by running the tests.

- [ ] **Step 5: Run tests**

```bash
cd /c/Users/andre/Code/ng-workspace && npx ng test ncached --no-watch --browsers=ChromeHeadless
```

Expected: All pass. If the import fails, switch to `import * as LZString from 'lz-string'`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/compressors/lz-string.compressor.ts src/lib/compressors/lz-string.compressor.spec.ts package.json projects/ncached/package.json
git commit -m "feat: add LzStringCompressor backed by lz-string"
```

---

## Task 11: INcachedConfig + NCACHED_CONFIG injection token

**Files:**
- Create: `src/lib/interfaces/ncached-config.interface.ts`
- Create: `src/lib/tokens/ncached-config.token.ts`

- [ ] **Step 1: Create INcachedConfig interface**

File: `src/lib/interfaces/ncached-config.interface.ts`

```typescript
import { ICompressor } from './compressor.interface';

/**
 * Configuration for the ncached library.
 * Provided via the NCACHED_CONFIG injection token.
 */
export interface INcachedConfig {
  /** Optional persistence configuration. Disabled by default. */
  persistence?: {
    /** Enable localStorage persistence. */
    enabled: boolean;
    /** localStorage key for the cache snapshot. Defaults to 'ncached_snapshot'. */
    storageKey?: string;
    /** Compression strategy. Defaults to NoopCompressor. */
    compressor?: ICompressor;
  };
}
```

- [ ] **Step 2: Create NCACHED_CONFIG token and provider helper**

File: `src/lib/tokens/ncached-config.token.ts`

```typescript
import { InjectionToken, Provider } from '@angular/core';
import { INcachedConfig } from '../interfaces/ncached-config.interface';

/**
 * Injection token for providing ncached configuration.
 *
 * @example
 * ```typescript
 * providers: [provideNcachedConfig({ persistence: { enabled: true } })]
 * ```
 */
export const NCACHED_CONFIG = new InjectionToken<INcachedConfig>('NcachedConfig');

/**
 * Convenience function to provide ncached configuration.
 *
 * @param config - The ncached configuration
 * @returns An Angular provider for the NCACHED_CONFIG token
 */
export function provideNcachedConfig(config: INcachedConfig): Provider {
  return { provide: NCACHED_CONFIG, useValue: config };
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/interfaces/ncached-config.interface.ts src/lib/tokens/ncached-config.token.ts
git commit -m "feat: add INcachedConfig interface and NCACHED_CONFIG injection token"
```

---

## Task 12: Serialization utilities (private methods on service)

Maps don't survive `JSON.stringify`. These private methods handle the round-trip.

**Files:**
- Modify: `src/lib/services/ncached.service.ts`
- Modify: `src/lib/services/ncached.service.spec.ts`

- [ ] **Step 1: Write failing tests**

```typescript
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /c/Users/andre/Code/ng-workspace && npx ng test ncached --no-watch --browsers=ChromeHeadless
```

Expected: FAIL — `_serialize` is not a function.

- [ ] **Step 3: Implement serialization methods**

Add to `ncached.service.ts` (alphabetically among private methods):

```typescript
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
```

- [ ] **Step 4: Run tests**

```bash
cd /c/Users/andre/Code/ng-workspace && npx ng test ncached --no-watch --browsers=ChromeHeadless
```

Expected: All pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/ncached.service.ts src/lib/services/ncached.service.spec.ts
git commit -m "feat: add cache serialization/deserialization with expired entry filtering"
```

---

## Task 13: Persistence — hydration on construction

Modify the constructor to accept optional config injection. If persistence is enabled, hydrate from localStorage.

**Files:**
- Modify: `src/lib/services/ncached.service.ts`
- Modify: `src/lib/services/ncached.service.spec.ts`

- [ ] **Step 1: Write failing tests**

Add a **new** describe block in the spec file (outside the existing one) for persistence testing. This needs a different TestBed configuration to provide the config:

```typescript
import { NCACHED_CONFIG } from '../tokens/ncached-config.token';
import { INcachedConfig } from '../interfaces/ncached-config.interface';
import { NoopCompressor } from '../compressors/noop.compressor';

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
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /c/Users/andre/Code/ng-workspace && npx ng test ncached --no-watch --browsers=ChromeHeadless
```

Expected: FAIL — service doesn't accept config injection yet.

- [ ] **Step 3: Update constructor and add hydration**

In `ncached.service.ts`, update imports:

```typescript
import { Inject, Injectable, Optional } from '@angular/core';
import { INcachedConfig } from '../interfaces/ncached-config.interface';
import { NCACHED_CONFIG } from '../tokens/ncached-config.token';
import { NoopCompressor } from '../compressors/noop.compressor';
import { ICompressor } from '../interfaces/compressor.interface';
```

Add private config/compressor properties (alphabetically):

```typescript
/**
 * The resolved compressor instance for the persistence layer.
 */
private _compressor: ICompressor;

/**
 * Library configuration, provided via NCACHED_CONFIG injection token.
 */
private _config: INcachedConfig | null;
```

Update constructor:

```typescript
constructor(@Optional() @Inject(NCACHED_CONFIG) config: INcachedConfig | null) {
  this._config = config ?? null;
  this._compressor = config?.persistence?.compressor ?? new NoopCompressor();

  if (config?.persistence?.enabled) {
    this._hydrate();
  }
}
```

Add private `_hydrate` method (alphabetically):

```typescript
/**
 * Hydrates the in-memory cache from localStorage.
 * Discards expired entries. Starts with empty cache on any failure.
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
```

- [ ] **Step 4: Run tests**

```bash
cd /c/Users/andre/Code/ng-workspace && npx ng test ncached --no-watch --browsers=ChromeHeadless
```

Expected: All pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/ncached.service.ts src/lib/services/ncached.service.spec.ts
git commit -m "feat: add cache hydration from localStorage on service construction"
```

---

## Task 14: Persistence — beforeunload snapshot

**Files:**
- Modify: `src/lib/services/ncached.service.ts`
- Modify: `src/lib/services/ncached.service.spec.ts`

- [ ] **Step 1: Write failing tests**

Add to the `describe('NcachedService (persistence)', ...)` block:

```typescript
it('should register a beforeunload listener when persistence is enabled', () => {
  spyOn(window, 'addEventListener');
  createServiceWithPersistence();
  expect(window.addEventListener).toHaveBeenCalledWith('beforeunload', jasmine.any(Function));
});

it('should persist cache to localStorage on beforeunload', () => {
  spyOn(window, 'addEventListener').and.callFake((event: string, handler: Function) => {
    if (event === 'beforeunload') {
      // Store handler for manual trigger
      (window as any).__beforeUnloadHandler = handler;
    }
  });

  const svc = createServiceWithPersistence();
  svc.set('data', 'mod', 'key');

  // Trigger beforeunload
  (window as any).__beforeUnloadHandler();

  const stored = localStorage.getItem(STORAGE_KEY);
  expect(stored).toBeTruthy();
  const parsed = JSON.parse(stored!);
  expect(parsed.mod.__mapEntries[0][1].value).toEqual('data');

  delete (window as any).__beforeUnloadHandler;
});

it('should handle QuotaExceededError gracefully on persist', () => {
  spyOn(window, 'addEventListener').and.callFake((event: string, handler: Function) => {
    if (event === 'beforeunload') {
      (window as any).__beforeUnloadHandler = handler;
    }
  });
  spyOn(localStorage, 'setItem').and.throwError(new DOMException('quota', 'QuotaExceededError'));
  spyOn(console, 'warn');

  const svc = createServiceWithPersistence();
  svc.set('data', 'mod', 'key');

  expect(() => (window as any).__beforeUnloadHandler()).not.toThrow();
  expect(console.warn).toHaveBeenCalled();

  delete (window as any).__beforeUnloadHandler;
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /c/Users/andre/Code/ng-workspace && npx ng test ncached --no-watch --browsers=ChromeHeadless
```

Expected: FAIL — `addEventListener` not called (no beforeunload registration yet).

- [ ] **Step 3: Implement beforeunload registration and persist**

Add to constructor (after `_hydrate` call):

```typescript
if (config?.persistence?.enabled) {
  this._hydrate();
  this._registerBeforeUnload();
}
```

Add private methods (alphabetically):

```typescript
/**
 * Persists the in-memory cache to localStorage.
 * Serializes and compresses the cache. Handles QuotaExceededError gracefully.
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
```

- [ ] **Step 4: Run tests**

```bash
cd /c/Users/andre/Code/ng-workspace && npx ng test ncached --no-watch --browsers=ChromeHeadless
```

Expected: All pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/ncached.service.ts src/lib/services/ncached.service.spec.ts
git commit -m "feat: persist cache to localStorage on beforeunload with compression"
```

---

## Task 15: clearAll() persistence integration

When `clearAll()` is called and persistence is enabled, also remove the localStorage entry.

**Files:**
- Modify: `src/lib/services/ncached.service.ts`
- Modify: `src/lib/services/ncached.service.spec.ts`

- [ ] **Step 1: Write failing test**

Add to the persistence describe block:

```typescript
it('[clearAll method] should also remove the localStorage entry when persistence is enabled', () => {
  localStorage.setItem(STORAGE_KEY, 'some-data');
  const svc = createServiceWithPersistence();
  svc.set('data', 'mod', 'key');
  svc.clearAll();
  expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /c/Users/andre/Code/ng-workspace && npx ng test ncached --no-watch --browsers=ChromeHeadless
```

Expected: FAIL — localStorage entry still exists after clearAll.

- [ ] **Step 3: Update clearAll()**

Replace `clearAll()` in `ncached.service.ts`:

```typescript
/**
 * Wipes the entire in-memory cache.
 * If persistence is enabled, also removes the localStorage entry.
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
```

- [ ] **Step 4: Run tests**

```bash
cd /c/Users/andre/Code/ng-workspace && npx ng test ncached --no-watch --browsers=ChromeHeadless
```

Expected: All pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/ncached.service.ts src/lib/services/ncached.service.spec.ts
git commit -m "feat: clearAll() removes localStorage entry when persistence is enabled"
```

---

## Task 16: Update public-api.ts exports

**Files:**
- Modify: `src/public-api.ts`

- [ ] **Step 1: Update exports**

Replace `src/public-api.ts` with:

```typescript
/*
 * Public API Surface of ncached
 */

// Compressors
export * from './lib/compressors/lz-string.compressor';
export * from './lib/compressors/noop.compressor';

// Interfaces
export * from './lib/interfaces/cache-entry.interface';
export * from './lib/interfaces/cache-object.interface';
export * from './lib/interfaces/cache-observable-options.interface';
export * from './lib/interfaces/compressor.interface';
export * from './lib/interfaces/ncached-config.interface';
export * from './lib/interfaces/set-options.interface';

// Namespaces
export * from './lib/namespaces/cache-service-errors.namespace';

// Services
export * from './lib/services/ncached.service';

// Tokens
export * from './lib/tokens/ncached-config.token';
```

- [ ] **Step 2: Run tests and build to verify exports compile**

```bash
cd /c/Users/andre/Code/ng-workspace && npx ng test ncached --no-watch --browsers=ChromeHeadless && npx ng build ncached
```

Expected: Tests pass, build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/public-api.ts
git commit -m "feat: export all new public API symbols"
```

---

## Task 17: Documentation + version bump to 0.1.0 + rxjs peer dep

**Files:**
- Modify: `package.json` (version, peerDependencies)
- Modify: `README.md`

- [ ] **Step 1: Update package.json**

In `projects/ncached/package.json`:

```json
{
  "name": "ncached",
  "version": "0.1.0",
  "peerDependencies": {
    "@angular/common": ">=13.0.0",
    "@angular/core": ">=13.0.0",
    "rxjs": ">=7.0.0"
  },
  "dependencies": {
    "tslib": "^2.3.0",
    "lz-string": "^1.5.0"
  },
  "sideEffects": false
}
```

Changes:
- Version: `0.0.2` → `0.1.0` (minor bump for new features)
- Angular peer deps: `^19.0.0` → `>=13.0.0` (broader compat per spec)
- Added `rxjs` as peer dependency
- Added `lz-string` as dependency (done in Task 10, verify it's here)

- [ ] **Step 2: Write README.md**

Create a comprehensive README at `projects/ncached/README.md` covering:

- What ncached is (one paragraph)
- Installation (`npm install ncached`)
- Quick start: basic set/get
- TTL: set with ttl option
- getOrDefault usage
- Invalidation: remove, clear, clearAll
- cacheObservable: caching HTTP calls
- Persistence: provideNcachedConfig with persistence enabled, compressor options
- API reference table (method signatures, one line each)

This should be a real, useful README — not a template. Write the actual content based on the implemented API.

- [ ] **Step 3: Run final coverage check**

```bash
cd /c/Users/andre/Code/ng-workspace && npx ng test ncached --no-watch --browsers=ChromeHeadless --code-coverage
```

Expected: All tests pass. Coverage >= 85% on statements, branches, functions, lines.

- [ ] **Step 4: Run production build**

```bash
cd /c/Users/andre/Code/ng-workspace && npx ng build ncached
```

Expected: Build succeeds with no errors.

- [ ] **Step 5: Commit**

```bash
git add package.json README.md
git commit -m "docs: add README and bump version to 0.1.0"
```

---

## Deliverables Coverage Check

| # | Deliverable | Task |
|---|-------------|------|
| 1 | ICompressor + NoopCompressor + LzStringCompressor | Tasks 9, 10 |
| 2 | ICacheEntry wrapper with expiresAt | Task 2 |
| 3 | TTL on set(), expiration on get() | Tasks 3, 4 |
| 4 | cacheObservable() | Task 7 |
| 5 | Request deduplication | Tasks 7, 8 |
| 6 | getOrDefault() | Task 5 |
| 7 | remove(), clear(), clearAll() | Task 6 |
| 8 | Persistence: beforeunload + hydration | Tasks 12, 13, 14 |
| 9 | INcachedConfig + injection token | Task 11 |
| 10 | Updated public-api.ts | Task 16 |
| 11 | Comprehensive tests | Every task |
| 12 | Existing tests passing | Verified in every task |
