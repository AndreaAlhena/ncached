---
id: ncached-service
title: NcachedService
sidebar_position: 1
---

# `NcachedService`

The single injectable that powers `ng-ncached`. Provided in `'root'`, so it's a singleton across the entire application.

```typescript
import { NcachedService } from 'ng-ncached';
```

## Public methods

| Method                                     | Purpose                                                                                  |
|--------------------------------------------|------------------------------------------------------------------------------------------|
| [`set`](#set)                              | Store a value under a key path, optionally with TTL.                                     |
| [`get`](#get)                              | Read a value back. Throws on miss / expired.                                             |
| [`getOrDefault`](#getordefault)            | Read a value back, returning a default on miss / expired. Never throws for misses.       |
| [`cacheObservable`](#cacheobservable)      | Cache the result of an Observable, with optional TTL, fallback, and request dedup.       |
| [`remove`](#remove)                        | Delete a single cache entry. No-op on missing path.                                      |
| [`clear`](#clear)                          | Delete an entire subtree / namespace. No-op on missing path.                             |
| [`clearAll`](#clearall)                    | Wipe the in-memory cache (and `localStorage` entry if persistence is on).                |

---

### `set`

```typescript
set<T = any>(value: T, ...args: Array<string | ISetOptions>): void
```

Stores `value` in the cache under the given key path.

- **`value`** — the value to store. No constraints.
- **`args`** — at least **two** strings. The last string is the `Map` key; everything before it is the namespace path. An optional [`ISetOptions`](./options.md#isetoptions) object may be passed as the **last** argument.
- **Returns** — `void`.

**Throws**

| Error                                                 | When                                |
|-------------------------------------------------------|-------------------------------------|
| `NcachedServiceErrors.InsufficientsKeysProvidedError` | Fewer than two **string** keys were passed |

**Example**

```typescript
this._cache.set<string>('Hello', 'app', 'greeting');
this._cache.set<IUser>(user, 'users', 'byId', user.id);
this._cache.set<string>(token, 'auth', 'token', { ttl: 60_000 });
```

See [Setting values](../guides/setting-values.md) and [TTL & expiration](../guides/ttl-and-expiration.md).

---

### `get`

```typescript
get<T = any>(...keys: string[]): T
```

Reads a value out of the cache using the same key path it was stored under.

- **`keys`** — at least **two** strings. Must match a path used in a previous `set()`.
- **`T`** — the expected type of the returned value. Strongly recommended.
- **Returns** — the cached value, typed as `T`.

**Throws**

| Error                                                 | When                                                                |
|-------------------------------------------------------|---------------------------------------------------------------------|
| `NcachedServiceErrors.InsufficientsKeysProvidedError` | Fewer than two keys were passed                                     |
| `NcachedServiceErrors.KeyNotFound`                    | A namespace key in the path doesn't exist                           |
| `NcachedServiceErrors.MapNotFound`                    | A key in the path exists but doesn't point to a `Map`               |
| `NcachedServiceErrors.ValueNotFound`                  | The map entry is missing **or** the entry has expired (TTL)         |

When an entry is expired, it is removed from the underlying `Map` before throwing.

**Example**

```typescript
const greeting = this._cache.get<string>('app', 'greeting');
const user = this._cache.get<IUser>('users', 'byId', 'usr_42');
```

See [Getting values](../guides/getting-values.md).

---

### `getOrDefault`

```typescript
getOrDefault<T = any>(defaultValue: T, ...keys: string[]): T
```

Reads a value, returning `defaultValue` if the entry is missing or expired. **Never throws** for cache misses.

- **`defaultValue`** — fallback returned on any cache miss.
- **`keys`** — same rules as `get()`.
- **Returns** — the cached value or `defaultValue`.

**Example**

```typescript
const theme = this._cache.getOrDefault<string>('light', 'ui', 'theme');
```

This is the safe, ergonomic accessor — prefer it over wrapping `get()` in a `try/catch`.

---

### `cacheObservable`

```typescript
cacheObservable<T = any>(
  source: Observable<T>,
  options: ICacheObservableOptions<T>,
  ...keys: string[]
): Observable<T>
```

Caches the result of an `Observable` source. On cache hit, emits the cached value via `of()` without subscribing to the source. On cache miss, subscribes to `source`, stores the emitted value (with optional TTL), and emits it.

- **`source`** — the upstream observable, typically an `HttpClient` call.
- **`options`** — `{ ttl?: number; defaultValue?: T }`. See [`ICacheObservableOptions`](./options.md#icacheobservableoptions).
- **`keys`** — same key path rules as `get`/`set`. Min 2.
- **Returns** — an `Observable<T>` that emits exactly once.

**Behaviour**

- **Concurrent calls** with the same keys share **one** subscription via `shareReplay({ bufferSize: 1, refCount: true })`. The in-flight entry is keyed by `keys.join('::')` and cleaned up on completion or error.
- **Source error + `defaultValue` provided** → emits `defaultValue`.
- **Source error, no `defaultValue`** → re-throws.

**Example**

```typescript
this._cache.cacheObservable<IUser[]>(
  this._http.get<IUser[]>('/api/users'),
  { ttl: 30_000 },
  'api', 'users',
).subscribe(users => console.log(users));
```

See [Caching observables](../guides/caching-observables.md).

---

### `remove`

```typescript
remove(...keys: string[]): void
```

Removes a single cache entry. The last key is the `Map` key; preceding keys navigate the hierarchy. No-op if the path or key does not exist. **Does not throw.**

**Example**

```typescript
this._cache.remove('users', 'currentName');
this._cache.remove('nonexistent', 'key'); // no-op
```

If fewer than two keys are passed, the call is a no-op (no exception).

---

### `clear`

```typescript
clear(...keys: string[]): void
```

Removes an entire subtree from the cache. Calling with one key drops a top-level namespace; calling with N keys drops the deepest node at that path. **No-op** on missing paths.

**Example**

```typescript
this._cache.clear('users');                     // drops all 'users'
this._cache.clear('users', 'byOrg', 'org-1');   // drops org-1 only
this._cache.clear();                            // no-op (use clearAll() to wipe)
```

---

### `clearAll`

```typescript
clearAll(): void
```

Wipes the entire in-memory cache. If [persistence](../guides/persistence-and-compression.md) is enabled, also removes the configured `localStorage` entry. The `localStorage` removal is best-effort — if it fails, the in-memory cache is still cleared.

**Example**

```typescript
this._cache.clearAll();
```

---

## Constructor

```typescript
constructor(@Optional() @Inject(NCACHED_CONFIG) config: INcachedConfig | null)
```

You don't call this directly — Angular's DI does. If [`provideNcachedConfig()`](./configuration.md#providencachedconfig) is in the providers, the resolved config is injected; otherwise `null` is used and the service runs in pure in-memory mode.

When `config.persistence.enabled` is `true`, the constructor:

1. Calls `_hydrate()` — reads `localStorage`, decompresses, deserialises, drops expired entries.
2. Registers a `beforeunload` listener that calls `_persist()`.

## Lifecycle and scope

`NcachedService` is `providedIn: 'root'`, so:

- It's a **singleton** across the whole app.
- The internal cache lives in memory for the duration of the page session — and across reloads if persistence is enabled.
- There's no built-in cross-tab synchronisation.

For multiple isolated cache instances (e.g. per feature), provide `NcachedService` at a lower injector level.
