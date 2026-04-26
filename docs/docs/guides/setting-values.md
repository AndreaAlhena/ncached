---
id: setting-values
title: Setting values
sidebar_position: 1
---

# Setting values

`NcachedService.set()` writes a value into the cache under one or more keys. The **last** string key is always the key inside a `Map`; every key before it acts as a namespace.

## Signature

```typescript
set<T = any>(value: T, ...args: Array<string | ISetOptions>): void
```

- `value` — the value you want to store. Anything goes: primitives, objects, observables, class instances.
- `args` — at least **two** string keys, optionally followed by an `ISetOptions` object as the **last** argument.

:::info
`ISetOptions` currently has one field: `{ ttl?: number }` (milliseconds). See [TTL & expiration](./ttl-and-expiration.md) for full details. The rest of this page focuses on the basics — no TTL.
:::

:::warning
Calling `set()` with fewer than two string keys throws `NcachedServiceErrors.InsufficientsKeysProvidedError`. See [Error handling](./error-handling.md).
:::

## Basic example: one namespace

This stores `'Ada Lovelace'` under the key `'currentName'` inside the `'users'` namespace:

```typescript
this._cache.set('Ada Lovelace', 'users', 'currentName');
```

Internally, the cache now looks like:

```typescript
{
  users: Map { 'currentName' => { value: 'Ada Lovelace', expiresAt: null } }
}
```

Each value is wrapped in an [`ICacheEntry`](../api/cache-entry.md) with an `expiresAt` field — `get()` unwraps this for you, so you never see the wrapper. `null` means "never expires".

## Storing complex objects

Values are stored by reference — there's no serialization at this layer, so use whatever shape works for your app:

```typescript
interface IUser {
  email: string;
  id: string;
  name: string;
}

const user: IUser = {
  email: 'ada@example.com',
  id: 'usr_42',
  name: 'Ada Lovelace',
};

this._cache.set<IUser>(user, 'users', user.id);
```

:::note
**Persistence note** — if you enable [persistence](./persistence-and-compression.md), values are serialised to JSON on `beforeunload`, so anything that doesn't survive `JSON.stringify` (functions, class instances with methods, `Date`, `Map`, circular refs) won't round-trip. For pure in-memory use, this doesn't apply.
:::

## With a TTL

Add an `ISetOptions` object as the last argument:

```typescript
this._cache.set('temporary', 'session', 'token', { ttl: 30000 }); // expires in 30 s
```

Full coverage in [TTL & expiration](./ttl-and-expiration.md).

## Real-world example: caching HTTP responses (manual)

A common pattern is to wrap an HTTP call so the second invocation comes from the cache. For most cases you'll want [`cacheObservable()`](./caching-observables.md) instead — it handles dedup, TTL and error fallbacks for you — but here's the manual version for reference:

```typescript
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, of, tap } from 'rxjs';
import { NcachedService } from 'ng-ncached';

interface IUser {
  email: string;
  id: string;
  name: string;
}

@Injectable({ providedIn: 'root' })
export class UserApi {
  private readonly _cache = inject(NcachedService);
  private readonly _http = inject(HttpClient);

  getUser(id: string): Observable<IUser> {
    const cached = this._cache.getOrDefault<IUser | null>(null, 'users', 'byId', id);

    if (cached) {
      return of(cached);
    }

    return this._http.get<IUser>(`/api/users/${id}`).pipe(
      tap((user: IUser) => this._cache.set<IUser>(user, 'users', 'byId', id, { ttl: 60000 })),
    );
  }
}
```

## Overwriting a value

Calling `set()` with the same key path replaces the existing entry, including resetting its TTL:

```typescript
this._cache.set('v1', 'config', 'apiVersion', { ttl: 5000 });
this._cache.set('v2', 'config', 'apiVersion'); // overwrites; no TTL now

this._cache.get<string>('config', 'apiVersion'); // 'v2'
```

## What's next?

- **[Getting values](./getting-values.md)** — read what you've stored, with type safety.
- **[TTL & expiration](./ttl-and-expiration.md)** — make entries expire automatically.
- **[Nested namespaces](./nested-namespaces.md)** — build deeper hierarchies.
