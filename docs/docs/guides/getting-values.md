---
id: getting-values
title: Getting values
sidebar_position: 2
---

# Getting values

`NcachedService.get()` reads a value back out of the cache using the same key path you wrote it under. There's also `getOrDefault()` for safe access without a `try/catch`.

## `get()` — strict, throws on miss

### Signature

```typescript
get<T = any>(...keys: string[]): T
```

- `keys` — the same key path you used in `set()`. At least **two** keys are required.
- `T` — an optional generic type for the returned value. Strongly recommended.

### Basic example

```typescript
this._cache.set('Ada Lovelace', 'users', 'currentName');

const name = this._cache.get<string>('users', 'currentName');
// name is typed as string
```

### Always provide a generic type

By default, `get()` returns `any`. Always pass a generic so callers stay type-safe:

```typescript
// Avoid — `user` is `any`
const user = this._cache.get('users', 'byId', 'usr_42');

// Prefer — `user` is `IUser`
const user = this._cache.get<IUser>('users', 'byId', 'usr_42');
```

### What `get()` throws

| Error                                | When it's thrown                                              |
|--------------------------------------|---------------------------------------------------------------|
| `InsufficientsKeysProvidedError`     | Fewer than two keys were passed                               |
| `KeyNotFound`                        | A namespace key in the path doesn't exist                     |
| `MapNotFound`                        | A key in the path exists but doesn't point to a `Map`         |
| `ValueNotFound`                      | The path is valid but the final key has no value, **or** the entry has expired |

When an entry is expired, `get()` deletes it from the `Map` before throwing — you don't need to clean up. See [Error handling](./error-handling.md) for the full discrimination pattern.

## `getOrDefault()` — safe, never throws on miss

### Signature

```typescript
getOrDefault<T = any>(defaultValue: T, ...keys: string[]): T
```

- `defaultValue` — returned when the key is missing or the entry has expired.
- `keys` — same rules as `get()`.
- Returns the cached value if present and fresh, otherwise `defaultValue`.

This is the right tool for **most** read sites — it's almost always cleaner than wrapping `get()` in a `try/catch`.

### Basic example

```typescript
const theme = this._cache.getOrDefault<string>('light', 'ui', 'theme');
// 'light' if 'ui'/'theme' is missing or expired

this._cache.set('dark', 'ui', 'theme');
this._cache.getOrDefault<string>('light', 'ui', 'theme'); // 'dark'
```

### Real-world example: a typed cached selector

```typescript
import { Injectable, inject } from '@angular/core';
import { NcachedService } from 'ng-ncached';

interface IFeatureFlags {
  betaSearch: boolean;
  darkMode: boolean;
}

const DEFAULT_FLAGS: IFeatureFlags = {
  betaSearch: false,
  darkMode: false,
};

@Injectable({ providedIn: 'root' })
export class FeatureFlagService {
  private readonly _cache = inject(NcachedService);

  getFlags(): IFeatureFlags {
    return this._cache.getOrDefault<IFeatureFlags>(DEFAULT_FLAGS, 'config', 'featureFlags');
  }

  setFlags(flags: IFeatureFlags): void {
    this._cache.set<IFeatureFlags>(flags, 'config', 'featureFlags');
  }
}
```

### When to prefer `get()` over `getOrDefault()`

Use `get()` when a missing entry is a **bug** in your call graph — you'd rather see a typed exception than silently fall back to a default.

Use `getOrDefault()` everywhere else.

## What's next?

- **[Nested namespaces](./nested-namespaces.md)** — go deeper than one level.
- **[TTL & expiration](./ttl-and-expiration.md)** — what "expired" means for `get()`.
- **[Error handling](./error-handling.md)** — discriminate every error type.
