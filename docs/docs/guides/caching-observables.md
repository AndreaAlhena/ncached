---
id: caching-observables
title: Caching observables
sidebar_position: 6
---

# Caching observables

`cacheObservable()` is the single biggest win for HTTP-heavy apps: one method gives you cache-then-fetch, automatic write-through, **request deduplication**, optional TTL, and an optional fallback value on error.

## Signature

```typescript
cacheObservable<T = any>(
  source: Observable<T>,
  options: ICacheObservableOptions<T>,
  ...keys: string[]
): Observable<T>
```

- `source` — the upstream observable, typically an HTTP call.
- `options` — `{ ttl?: number; defaultValue?: T }`. See [`ICacheObservableOptions`](../api/options.md).
- `keys` — same key path rules as `get`/`set`. Min 2.

## What it does

1. **Cache hit?** Emit the cached value via `of(cached)`. The source is **never subscribed to**.
2. **Cache miss?** Subscribe to `source`, store the emitted value (with TTL if provided), then emit it.
3. **Concurrent calls with the same keys?** They share **one** subscription via `shareReplay({ bufferSize: 1, refCount: true })`. N callers = 1 HTTP request.
4. **Source errors?** If `defaultValue` is in `options`, emit it. Otherwise re-throw.

The "in-flight" entry is cleaned up automatically when the source completes or errors.

## Basic example

```typescript
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
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
    return this._cache.cacheObservable(
      this._http.get<IUser>(`/api/users/${id}`),
      { ttl: 60_000 },
      'api', 'users', id,
    );
  }
}
```

The first call hits the network and caches the result. Every call within the next 60 seconds returns the cached value with no network round-trip.

## Request deduplication

The big trick: if 5 components subscribe to `getUser('u1')` in the same tick, only **one** HTTP request fires. The other four share the response.

```typescript
// All three subscriptions share a single HTTP call:
this._userApi.getUser('u1').subscribe(...);
this._userApi.getUser('u1').subscribe(...);
this._userApi.getUser('u1').subscribe(...);
```

Different keys → different subscriptions:

```typescript
this._userApi.getUser('u1').subscribe(); // request 1
this._userApi.getUser('u2').subscribe(); // request 2
```

This works without any setup on your side — `cacheObservable()` keys an internal in-flight `Map` by `keys.join('::')`.

## Fallback on error

Pass `defaultValue` to suppress source errors and emit the fallback instead:

```typescript
const DEFAULT_FLAGS: IFeatureFlags = { betaSearch: false, darkMode: false };

this._cache.cacheObservable<IFeatureFlags>(
  this._http.get<IFeatureFlags>('/api/feature-flags'),
  { ttl: 5 * 60_000, defaultValue: DEFAULT_FLAGS },
  'api', 'featureFlags',
);
```

If the request fails, subscribers receive `DEFAULT_FLAGS` (and the failure is **not** cached — the next call will retry).

:::tip
`defaultValue` is only used on **source error**, not on cache miss. Cache misses always go to the network.
:::

If `defaultValue` is **omitted** from `options`, source errors propagate normally — wrap with `catchError` if you need to react.

## Without TTL

Omit `ttl` for a "cache once, never expire" entry:

```typescript
// Cache lookup tables for the lifetime of the page
this._cache.cacheObservable(
  this._http.get<ICountry[]>('/api/countries'),
  {},
  'lookup', 'countries',
);
```

## Real-world example: search-as-you-type with dedup

When a user types fast, multiple identical queries can fire. Dedup makes this safe — and TTL keeps results fresh:

```typescript
import { Component, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, debounceTime, distinctUntilChanged, switchMap, of } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { NcachedService } from 'ng-ncached';

interface ISearchResult {
  id: string;
  title: string;
}

@Component({
  selector: 'app-search',
  standalone: true,
  template: `
    <input [value]="query()" (input)="onInput($event)" placeholder="Search..." />
    @for (item of results(); track item.id) {
      <div>{{ item.title }}</div>
    }
  `,
})
export class SearchComponent {
  private readonly _cache = inject(NcachedService);
  private readonly _http = inject(HttpClient);

  query = signal('');
  results = toSignal(
    toObservable(this.query).pipe(
      debounceTime(200),
      distinctUntilChanged(),
      switchMap((q: string) =>
        q.length < 2
          ? of([] as ISearchResult[])
          : this._cache.cacheObservable<ISearchResult[]>(
              this._http.get<ISearchResult[]>('/api/search', { params: { q } }),
              { ttl: 30_000, defaultValue: [] },
              'search', q,
            ),
      ),
    ),
    { initialValue: [] as ISearchResult[] },
  );

  onInput(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }
}
```

Hitting backspace after typing the same query a few times costs **zero** network requests for 30 seconds, even from different components.

## Cleanup and refetching

- **Force refetch one key:** `cache.remove('api', 'users', id)` then re-subscribe.
- **Force refetch a whole namespace:** `cache.clear('api', 'users')`.
- **Wait for natural expiry:** rely on `ttl`.

See [Invalidation](./invalidation.md).

## What's next?

- **[Persistence & compression](./persistence-and-compression.md)** — make cached HTTP results survive reloads.
- **[Configuration](./configuration.md)** — `provideNcachedConfig()`.
- **[`cacheObservable` API reference](../api/ncached-service.md#cacheobservable)** — full method docs.
