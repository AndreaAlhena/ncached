---
id: ttl-and-expiration
title: TTL & expiration
sidebar_position: 4
---

# TTL & expiration

Every cache entry can carry a **time-to-live** in milliseconds. When a TTL is set, the entry expires `ttl` ms after it was written; once expired, `get()` treats it as missing (and removes it from the underlying `Map`).

No background timer runs. Expiration is checked **lazily on access**, which keeps the implementation tiny and avoids any zone / change-detection overhead.

## How TTL works

Internally, every cached value is wrapped in an [`ICacheEntry<T>`](../api/cache-entry.md):

```typescript
interface ICacheEntry<T> {
  value: T;
  expiresAt: number | null; // epoch ms, or null = never expires
}
```

- `set()` without options → `expiresAt: null` → never expires.
- `set()` with `{ ttl: ms }` → `expiresAt: Date.now() + ms`.
- `get()` checks `Date.now() > entry.expiresAt`. If so, it deletes the entry and throws `ValueNotFound`.
- `getOrDefault()` does the same check but returns the fallback instead of throwing.

## Setting a TTL

```typescript
// Expires in 30 seconds
this._cache.set('temporary', 'session', 'token', { ttl: 30_000 });

// Expires in 1 hour
this._cache.set(profile, 'users', 'currentProfile', { ttl: 60 * 60 * 1000 });
```

Convention: declare TTLs as constants so the unit is obvious in the call site:

```typescript
const ONE_MINUTE = 60_000;
const ONE_HOUR = 60 * ONE_MINUTE;

this._cache.set(token, 'auth', 'token', { ttl: ONE_HOUR });
```

## Reading a possibly-expired entry

`get()` throws `ValueNotFound` on an expired entry:

```typescript
import { NcachedServiceErrors } from 'ng-ncached';

try {
  const token = this._cache.get<string>('auth', 'token');
  useToken(token);
} catch (error) {
  if (error instanceof NcachedServiceErrors.ValueNotFound) {
    redirectToLogin();
    return;
  }
  throw error;
}
```

`getOrDefault()` is usually nicer:

```typescript
const token = this._cache.getOrDefault<string | null>(null, 'auth', 'token');

if (!token) {
  redirectToLogin();
  return;
}
```

## Real-world example: a short-lived auth token

```typescript
import { Injectable, inject } from '@angular/core';
import { Observable, of, tap } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { NcachedService } from 'ng-ncached';

interface IToken {
  accessToken: string;
  expiresIn: number; // seconds, from the auth server
}

@Injectable({ providedIn: 'root' })
export class AuthTokenService {
  private readonly _cache = inject(NcachedService);
  private readonly _http = inject(HttpClient);

  getToken(): Observable<string> {
    const cached = this._cache.getOrDefault<string | null>(null, 'auth', 'accessToken');

    if (cached) {
      return of(cached);
    }

    return this._http.post<IToken>('/api/auth/token', {}).pipe(
      tap((token: IToken) => {
        // Subtract a small safety margin so the cached token expires
        // slightly before the server considers it invalid.
        const ttl = (token.expiresIn - 30) * 1000;
        this._cache.set(token.accessToken, 'auth', 'accessToken', { ttl });
      }),
      // Map the raw token response to the access string for callers
      // (omitted here for brevity)
    ) as Observable<string>;
  }
}
```

## Refreshing a value before it expires

There's no built-in "stale-while-revalidate" mode. The two common patterns are:

**Read-through:** miss → fetch → write. Simple, accepts a brief latency on the first request after expiry. This is exactly what [`cacheObservable()`](./caching-observables.md) does.

**Eager refresh:** schedule a refresh slightly before `ttl` elapses. Easy to bolt on with `setTimeout`, but you own the lifecycle:

```typescript
const ttl = 60_000;
this._cache.set(value, 'mod', 'key', { ttl });

setTimeout(() => {
  // re-fetch + this._cache.set(...)
}, ttl - 5_000);
```

For most apps, the read-through pattern is enough.

## Expiry under persistence

If [persistence](./persistence-and-compression.md) is enabled:

- Expired entries are **discarded during serialization** — they don't bloat the `localStorage` snapshot.
- Expired entries are also **discarded during hydration**, so a tab reopened after a long sleep starts with a clean cache.

This means TTL behaves consistently across reloads — a 30 s entry written 25 s before reload will still exist for ~5 s after the reload, then expire as expected.

## What's next?

- **[Caching observables](./caching-observables.md)** — TTL, dedup and HTTP fallbacks in one method.
- **[Invalidation](./invalidation.md)** — explicit removal vs TTL.
- **[Error handling](./error-handling.md)** — discriminating expiry from a real miss.
