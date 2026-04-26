---
id: nested-namespaces
title: Nested namespaces
sidebar_position: 3
---

# Nested namespaces

`ng-ncached` is called *n*-cached for a reason: you can nest namespaces as deep as your domain requires. Every key in the path before the last one becomes a namespace; the last key is the entry inside a `Map`.

## How depth works

The rule is consistent across `set()` and `get()`:

> The last key is the **Map key**. Every key before it is a **namespace path**.

So this call:

```typescript
this._cache.set('payload', 'reports', 'sales', 'byRegion', 'EU');
```

…builds the following structure internally:

```typescript
{
  reports: {
    sales: {
      byRegion: Map { 'EU' => 'payload' }
    }
  }
}
```

And the matching read uses the exact same path:

```typescript
this._cache.get<string>('reports', 'sales', 'byRegion', 'EU'); // 'payload'
```

## Real-world example: per-org, per-user data

Imagine a multi-tenant app where you cache user lookups per organisation. A natural namespace shape is:

```
users → byOrg → <orgId> → <userId>
```

```typescript
import { Injectable, inject } from '@angular/core';
import { NcachedService } from 'ng-ncached';

interface IUser {
  email: string;
  id: string;
  name: string;
}

@Injectable({ providedIn: 'root' })
export class OrgUserCache {
  private readonly _cache = inject(NcachedService);

  getUser(orgId: string, userId: string): IUser {
    return this._cache.get<IUser>('users', 'byOrg', orgId, userId);
  }

  setUser(orgId: string, user: IUser): void {
    this._cache.set<IUser>(user, 'users', 'byOrg', orgId, user.id);
  }
}
```

Two organisations stay completely isolated:

```typescript
orgUserCache.setUser('org-1', { id: 'u1', name: 'Ada',  email: 'a@x' });
orgUserCache.setUser('org-2', { id: 'u1', name: 'Alan', email: 'b@x' });

orgUserCache.getUser('org-1', 'u1').name; // 'Ada'
orgUserCache.getUser('org-2', 'u1').name; // 'Alan'
```

## Designing a good key path

Treat the key path like a URL — read from least specific to most specific:

| Good                                            | Why                                              |
|-------------------------------------------------|--------------------------------------------------|
| `'users'`, `'byOrg'`, `orgId`, `userId`         | Reads like a path; easy to scan                  |
| `'reports'`, `'sales'`, `'byRegion'`, regionId  | Module → entity → index → id                     |

Avoid:

| Avoid                                           | Why                                              |
|-------------------------------------------------|--------------------------------------------------|
| `${orgId}-${userId}` as a single key            | You lose the namespace boundary                  |
| Mixing static and dynamic keys at the same depth| Hard to enumerate; risk of accidental collisions |

## A small wrapper for type-safe keys

If you find yourself repeating the same path, encode it in a service:

```typescript
import { Injectable, inject } from '@angular/core';
import { NcachedService } from 'ng-ncached';

@Injectable({ providedIn: 'root' })
export class ReportCache {
  private readonly _cache = inject(NcachedService);

  get(region: string, year: number): IReport {
    return this._cache.get<IReport>('reports', 'sales', 'byRegion', region, String(year));
  }

  set(region: string, year: number, report: IReport): void {
    this._cache.set<IReport>(report, 'reports', 'sales', 'byRegion', region, String(year));
  }
}
```

This keeps the key path in **one place**, so a typo can never silently miss the cache from a different file.

## What's next?

- **[Error handling](./error-handling.md)** — recover gracefully from misses.
- **[API Reference](../api/ncached-service.md)** — full method signatures.
