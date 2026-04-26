---
id: getting-started
title: Getting Started
sidebar_position: 2
---

# Getting Started

This page walks you through installing `ng-ncached`, injecting the service, and using its core features for the first time.

## Requirements

| Dependency        | Minimum version | Reason                                                                  |
|-------------------|-----------------|-------------------------------------------------------------------------|
| `@angular/core`   | 12.0.0          | Partial Ivy compilation requires the Angular Linker (default since v12) |
| `@angular/common` | 12.0.0          | Same as above                                                           |
| `rxjs`            | 7.0.0           | Uses `throwError(() => error)` factory form (RxJS 7+)                   |

`ng-ncached` ships with `lz-string` as its only runtime dependency (used by the optional `LzStringCompressor`). `tslib` is a standard Angular peer.

## Installation

```bash
npm install ng-ncached
```

```bash
yarn add ng-ncached
```

```bash
pnpm add ng-ncached
```

That's it for the basics — no module to import. `NcachedService` is `providedIn: 'root'`.

:::tip Want persistence?
The service works zero-config for in-memory caching. To make it survive page reloads — or to plug in compression / a custom storage key — see the [Configuration guide](./guides/configuration.md). It's an opt-in via a single `provideNcachedConfig()` call.
:::

## Inject the service

### In a standalone component

```typescript
import { Component, inject } from '@angular/core';
import { NcachedService } from 'ng-ncached';

@Component({
  selector: 'app-user-profile',
  standalone: true,
  template: `<p>{{ name }}</p>`,
})
export class UserProfileComponent {
  private readonly _cache = inject(NcachedService);

  name = this._cache.getOrDefault<string>('Guest', 'users', 'currentName');
}
```

### In a service

```typescript
import { Injectable, inject } from '@angular/core';
import { NcachedService } from 'ng-ncached';

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly _cache = inject(NcachedService);

  cacheCurrentUser(name: string): void {
    this._cache.set(name, 'users', 'currentName');
  }
}
```

## Your first cache hit

A complete, copy-pasteable example:

```typescript
import { Component, inject, OnInit } from '@angular/core';
import { NcachedService } from 'ng-ncached';

@Component({
  selector: 'app-root',
  standalone: true,
  template: `
    <h1>{{ greeting }}</h1>
    <button (click)="refresh()">Refresh</button>
  `,
})
export class AppComponent implements OnInit {
  private readonly _cache = inject(NcachedService);

  greeting = '';

  ngOnInit(): void {
    this._cache.set('Hello, world!', 'app', 'greeting');
    this.refresh();
  }

  refresh(): void {
    this.greeting = this._cache.getOrDefault('(no greeting)', 'app', 'greeting');
  }
}
```

## A 60-second tour of the API

Once you've got that working, here's everything `NcachedService` can do — each line links to the in-depth guide.

```typescript
// Store a value (min 2 keys: namespace + map key)
cache.set('Alice', 'users', 'currentName');

// Store with a TTL — expires in 30 seconds
cache.set(token, 'auth', 'token', { ttl: 30000 });

// Read it back, throws on miss / expiry
cache.get<string>('users', 'currentName');

// Read with a fallback, never throws
cache.getOrDefault('Guest', 'users', 'currentName');

// Cache an HTTP call, dedupe concurrent callers, expire after 1 minute
cache.cacheObservable(http.get('/api/users'), { ttl: 60000 }, 'api', 'users');

// Invalidate
cache.remove('users', 'currentName'); // one entry
cache.clear('users');                  // a whole namespace
cache.clearAll();                      // everything
```

For persistence across page reloads, see [Persistence & compression](./guides/persistence-and-compression.md) — it's an opt-in via `provideNcachedConfig()`.

## Where next?

- **[Setting values](./guides/setting-values.md)** — `set()` patterns
- **[TTL & expiration](./guides/ttl-and-expiration.md)** — make entries auto-expire
- **[Caching observables](./guides/caching-observables.md)** — the killer feature for HTTP-heavy apps
- **[Persistence & compression](./guides/persistence-and-compression.md)** — survive page reloads
