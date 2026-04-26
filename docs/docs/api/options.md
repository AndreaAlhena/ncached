---
id: options
title: Options interfaces
sidebar_position: 2
---

# Options interfaces

Two small option types control the behaviour of `set()` and `cacheObservable()`.

## ISetOptions

```typescript
import { ISetOptions } from 'ng-ncached';

interface ISetOptions {
  ttl?: number;
}
```

Passed as the **last** argument to [`set()`](./ncached-service.md#set).

| Field  | Type      | Default        | Notes                                                                              |
|--------|-----------|----------------|------------------------------------------------------------------------------------|
| `ttl`  | `number?` | `undefined`    | Time-to-live in **milliseconds**. Omit for no expiration. `0` is treated as no TTL. |

**Example**

```typescript
this._cache.set(token, 'auth', 'token', { ttl: 60_000 });
```

When `ttl` is set, the entry is internally written with `expiresAt = Date.now() + ttl`. See [TTL & expiration](../guides/ttl-and-expiration.md).

---

## ICacheObservableOptions

```typescript
import { ICacheObservableOptions } from 'ng-ncached';

interface ICacheObservableOptions<T = unknown> {
  ttl?: number;
  defaultValue?: T;
}
```

Passed as the **second** argument to [`cacheObservable()`](./ncached-service.md#cacheobservable).

| Field          | Type      | Default        | Notes                                                                              |
|----------------|-----------|----------------|------------------------------------------------------------------------------------|
| `ttl`          | `number?` | `undefined`    | Time-to-live in **milliseconds** for the cached result. Omit for no expiration.    |
| `defaultValue` | `T?`      | none           | Emitted if the source observable errors. Omit to let errors propagate.             |

`defaultValue` is only consulted on **source error**, not on cache miss. Cache misses always go to the network.

**Example**

```typescript
this._cache.cacheObservable<IConfig>(
  this._http.get<IConfig>('/api/config'),
  { ttl: 5 * 60_000, defaultValue: DEFAULTS },
  'api', 'config',
);
```

See [Caching observables](../guides/caching-observables.md).
