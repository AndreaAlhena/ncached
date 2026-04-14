<p align="center">
   <img src="https://iili.io/2StGF3l.th.png" alt="ncached logo">
</p>

# ncached

A lightweight, hierarchical in-memory cache for Angular applications. Supports TTL expiration, observable caching with request deduplication, and optional localStorage persistence with pluggable compression.

## Installation

```bash
npm install ncached
```

## Compatibility

| Dependency        | Min version | Reason                                                                  |
|-------------------|-------------|-------------------------------------------------------------------------|
| `@angular/core`   |      12.0.0 | Partial Ivy compilation requires the Angular Linker (default since v12) |
| `@angular/common` |      12.0.0 | Same as above                                                           |
| `rxjs`            |       7.0.0 | Uses `throwError(() => error)` factory form (RxJS 7+)                   |

## Quick Start

`NcachedService` is provided in root -- just inject it:

```typescript
import { NcachedService } from 'ncached';

@Component({ ... })
export class MyComponent {
  constructor(private _ncached: NcachedService) {
    // Store a value under module "users" with key "currentUser"
    this._ncached.set({ name: 'Alice' }, 'users', 'currentUser');

    // Retrieve it
    const user = this._ncached.get<{ name: string }>('users', 'currentUser');
    // => { name: 'Alice' }
  }
}
```

Keys form a hierarchy: the first key identifies a module/namespace, the last key is the Map entry key, and any intermediate keys create nested sub-groups:

```typescript
cache.set(42, 'analytics', 'dashboard', 'visits');
cache.get<number>('analytics', 'dashboard', 'visits'); // => 42
```

## TTL (Time-to-Live)

Pass an options object as the last argument to `set()`:

```typescript
cache.set('temporary', 'session', 'token', { ttl: 30000 }); // expires in 30 seconds
```

After expiration, `get()` throws `NcachedServiceErrors.ValueNotFound` and the entry is removed automatically.

## getOrDefault

Retrieve a value without risking an exception on cache miss or expiration:

```typescript
const theme = cache.getOrDefault<string>('light', 'ui', 'theme');
// Returns 'light' if 'ui'/'theme' is missing or expired
```

## Invalidation

```typescript
// Remove a single entry
cache.remove('users', 'currentUser');

// Clear an entire module (removes the 'users' namespace and all its entries)
cache.clear('users');

// Wipe everything (also clears localStorage if persistence is enabled)
cache.clearAll();
```

## Caching Observables

`cacheObservable()` wraps an Observable source (typically an HTTP call), caches the emitted value, and deduplicates concurrent requests for the same keys:

```typescript
import { NcachedService, ICacheObservableOptions } from 'ncached';

@Injectable({ providedIn: 'root' })
export class UserService {
  constructor(private _http: HttpClient, private _ncached: NcachedService) {}

  public getUser(id: string): Observable<IUser> {
    const source$ = this._http.get<IUser>(`/api/users/${id}`);
    const options: ICacheObservableOptions<IUser> = { ttl: 60000 };

    return this._ncached.cacheObservable(source$, options, 'users', id);
  }
}
```

If the value is already cached and not expired, the source Observable is never subscribed to. Concurrent calls with the same keys share a single subscription.

You can provide a `defaultValue` that is emitted if the source errors:

```typescript
this._ncached.cacheObservable(source$, { ttl: 60000, defaultValue: null }, 'users', id);
```

## Persistence

Enable localStorage persistence so the cache survives page reloads. The cache is saved on `beforeunload` and restored on service initialization.

```typescript
import { provideNcachedConfig } from 'ncached';

// In your app config or module providers:
providers: [
  provideNcachedConfig({
    persistence: {
      enabled: true,
      storageKey: 'my_app_cache' // optional, defaults to 'ncached_snapshot'
    }
  })
]
```

### Compression

By default, persistence uses `NoopCompressor` (no compression). For smaller storage footprint, use the built-in lz-string compressor:

```typescript
import { provideNcachedConfig, LzStringCompressor } from 'ncached';

providers: [
  provideNcachedConfig({
    persistence: {
      enabled: true,
      compressor: new LzStringCompressor()
    }
  })
]
```

You can also implement the `ICompressor` interface for a custom strategy:

```typescript
import { ICompressor } from 'ncached';

export class MyCompressor implements ICompressor {
  public compress(data: string): string { /* ... */ }
  public decompress(data: string): string { /* ... */ }
}
```

Compressors must be synchronous because persistence runs inside a `beforeunload` handler.

## API Reference

### NcachedService

| Method            | Signature                                                                                                          | Description                                                            |
|-------------------|--------------------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------|
| `set`             | `set<T>(value: T, ...args: Array<string \| ISetOptions>): void`                                                    | Store a value. Min 2 keys. Optional TTL via `{ ttl: ms }` as last arg. |
| `get`             | `get<T>(...keys: string[]): T`                                                                                     | Retrieve a value. Throws if missing or expired.                        |
| `getOrDefault`    | `getOrDefault<T>(defaultValue: T, ...keys: string[]): T`                                                           | Retrieve a value or return the default. Never throws for missing keys. |
| `remove`          | `remove(...keys: string[]): void`                                                                                  | Delete a single cache entry. No-op if path does not exist.             |
| `clear`           | `clear(...keys: string[]): void`                                                                                   | Delete an entire subtree/namespace.                                    |
| `clearAll`        | `clearAll(): void`                                                                                                 | Wipe all cached data. Clears localStorage if persistence is enabled.   |
| `cacheObservable` | `cacheObservable<T>(source: Observable<T>, options: ICacheObservableOptions<T>, ...keys: string[]): Observable<T>` | Cache an Observable result with deduplication.                         |

### Interfaces

| Interface                    | Description                                                            |
|------------------------------|------------------------------------------------------------------------|
| `ISetOptions`                | `{ ttl?: number }` -- TTL in milliseconds.                             |
| `ICacheObservableOptions<T>` | `{ ttl?: number; defaultValue?: T }` -- Options for `cacheObservable`. |
| `INcachedConfig`             | Persistence configuration provided via `provideNcachedConfig()`.       |
| `ICompressor`                | `{ compress(data: string): string; decompress(data: string): string }` |
| `ICacheEntry<T>`             | `{ value: T; expiresAt: number \| null }` -- Internal entry wrapper.   |
| `ICacheObject`               | Recursive cache hierarchy type.                                        |

### Utilities

| Export                         | Description                                                                                                    |
|--------------------------------|----------------------------------------------------------------------------------------------------------------|
| `provideNcachedConfig(config)` | Convenience provider factory for `NCACHED_CONFIG`.                                                             |
| `NCACHED_CONFIG`               | Angular `InjectionToken<INcachedConfig>`.                                                                      |
| `LzStringCompressor`           | lz-string UTF-16 compressor.                                                                                   |
| `NoopCompressor`               | Pass-through (no compression).                                                                                 |
| `NcachedServiceErrors`           | Namespace with error classes: `KeyNotFound`, `ValueNotFound`, `MapNotFound`, `InsufficientsKeysProvidedError`. |
