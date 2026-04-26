---
id: invalidation
title: Invalidation
sidebar_position: 5
---

# Invalidation

Three methods cover everything from "drop a single entry" to "wipe the world": `remove`, `clear`, `clearAll`. All are no-ops on missing paths — they never throw.

## At a glance

| Method                        | Scope                                       | No-op on missing path? |
|-------------------------------|---------------------------------------------|------------------------|
| `remove(...keys)`             | One entry inside a `Map`                    | ✅                      |
| `clear(...keys)`              | An entire namespace / subtree               | ✅                      |
| `clearAll()`                  | Everything (also `localStorage` if enabled) | n/a                    |

## `remove(...keys)`

Removes a single cache entry. Same key-path semantics as `get()` / `set()`: the last key is the `Map` entry key; everything before it navigates the hierarchy.

```typescript
this._cache.set('val1', 'users', 'currentName');
this._cache.set('val2', 'users', 'lastSeen');

this._cache.remove('users', 'currentName');

this._cache.get<string>('users', 'lastSeen'); // 'val2' — survives
this._cache.getOrDefault<string>('—', 'users', 'currentName'); // '—'
```

Calling `remove()` with fewer than two keys is a no-op. Calling it on a path that doesn't exist is also a no-op:

```typescript
this._cache.remove('nope', 'still-nope'); // does nothing, doesn't throw
```

## `clear(...keys)`

Removes an **entire subtree** — useful when you've invalidated a whole module or tenant.

```typescript
this._cache.set('a', 'users', 'byOrg', 'org-1', 'u1');
this._cache.set('b', 'users', 'byOrg', 'org-1', 'u2');
this._cache.set('c', 'users', 'byOrg', 'org-2', 'u1');

// Drop everything for org-1
this._cache.clear('users', 'byOrg', 'org-1');

this._cache.getOrDefault('—', 'users', 'byOrg', 'org-1', 'u1'); // '—'
this._cache.get<string>('users', 'byOrg', 'org-2', 'u1');       // 'c' — survives
```

Calling `clear()` with **one** key drops a whole top-level namespace:

```typescript
this._cache.clear('users'); // removes the entire 'users' branch
```

Calling `clear()` with no keys is a no-op (it does **not** wipe the cache — use `clearAll()` for that).

## `clearAll()`

Wipes the entire in-memory cache. If [persistence](./persistence-and-compression.md) is enabled, the `localStorage` entry is removed too.

```typescript
this._cache.set('a', 'mod1', 'key');
this._cache.set('b', 'mod2', 'key');

this._cache.clearAll();

this._cache.getOrDefault('—', 'mod1', 'key'); // '—'
```

Use it for sign-out flows, "switch account" actions, or after a global config change.

## Real-world example: invalidation on user logout

```typescript
import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { NcachedService } from 'ng-ncached';

@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly _cache = inject(NcachedService);
  private readonly _router = inject(Router);

  logout(): void {
    this._cache.clearAll();
    this._router.navigate(['/login']);
  }
}
```

## Real-world example: targeted invalidation after a mutation

When a write succeeds on the server, drop the cached read for that resource so the next call refetches:

```typescript
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { NcachedService } from 'ng-ncached';

interface IUser {
  email: string;
  id: string;
  name: string;
}

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly _cache = inject(NcachedService);
  private readonly _http = inject(HttpClient);

  updateUser(user: IUser): Observable<IUser> {
    return this._http.put<IUser>(`/api/users/${user.id}`, user).pipe(
      tap(() => this._cache.remove('api', 'users', user.id)),
    );
  }
}
```

If a single write affects an entire collection, clear the namespace instead of removing one entry:

```typescript
this._cache.clear('api', 'users');
```

## TTL vs explicit invalidation

| Use case                                                           | Prefer            |
|--------------------------------------------------------------------|-------------------|
| Data is expensive to fetch but acceptably stale for N seconds      | TTL via `set()`   |
| Data is invalidated by a specific action (write, logout, settings) | `remove`/`clear`  |

The two compose well — set a generous TTL as a safety net, and explicitly invalidate on known mutations.

## What's next?

- **[Caching observables](./caching-observables.md)** — combine TTL + dedup + invalidation around HTTP calls.
- **[Persistence & compression](./persistence-and-compression.md)** — `clearAll()` also wipes `localStorage`.
