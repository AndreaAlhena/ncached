---
id: error-handling
title: Error handling
sidebar_position: 9
---

# Error handling

`get()`, `set()` and `cacheObservable()` throw on failure. Errors are typed classes living under the `NcachedServiceErrors` namespace, so you can use `instanceof` to discriminate cases.

For most read sites, prefer **[`getOrDefault()`](./getting-values.md#getordefault--safe-never-throws-on-miss)** — it's the built-in safe accessor, and you won't need any of the patterns on this page. This guide is for the cases where the typed errors *do* matter.

## The four error types

| Error                                              | Thrown by                | Meaning                                                                |
|----------------------------------------------------|--------------------------|------------------------------------------------------------------------|
| `InsufficientsKeysProvidedError`                   | `get`, `set`             | Fewer than two keys were passed                                        |
| `KeyNotFound`                                      | `get`, `cacheObservable` | A namespace key in the path doesn't exist                              |
| `MapNotFound`                                      | `get`, `cacheObservable` | A key in the path exists but doesn't point to a `Map`                  |
| `ValueNotFound`                                    | `get`, `cacheObservable` | The path is valid but the final key has no value, **or** the entry has expired |

All four extend the native `Error` and carry a descriptive `message`.

`cacheObservable()` only surfaces these on the **first** subscription path before falling through to the source. Cache misses inside `cacheObservable()` are handled internally — they trigger a fetch, not a throw.

## Importing the namespace

```typescript
import { NcachedServiceErrors } from 'ng-ncached';
```

## Discriminating with `instanceof`

```typescript
import { NcachedService, NcachedServiceErrors } from 'ng-ncached';

try {
  const value = this._cache.get<string>('users', 'currentName');
  // ...use value
} catch (error) {
  if (error instanceof NcachedServiceErrors.InsufficientsKeysProvidedError) {
    // Programmer error — usually a bug, not a runtime condition.
    console.error('Bad call to get():', error.message);
    return;
  }

  if (error instanceof NcachedServiceErrors.KeyNotFound) {
    // The whole namespace branch hasn't been seeded yet.
    return;
  }

  if (error instanceof NcachedServiceErrors.MapNotFound) {
    // A namespace exists at this key, but no Map has been created.
    return;
  }

  if (error instanceof NcachedServiceErrors.ValueNotFound) {
    // Cache miss for this specific entry, OR the entry has expired.
    return;
  }

  // Anything else is unexpected — re-throw.
  throw error;
}
```

## Distinguishing "expired" from "never seen"

`ValueNotFound` is thrown for **both** of these cases:

- The key exists in the path but has no entry in the `Map`.
- The entry exists but its `expiresAt` is in the past.

If you need to distinguish, do the check yourself before calling `get()`:

```typescript
import { ICacheEntry } from 'ng-ncached';

// Reach into the internal Map (use sparingly — relies on the wrapper shape).
function diagnoseMiss(cache: any, ...keys: string[]): 'never-seen' | 'expired' | 'present' {
  // ...walk the cache and inspect ICacheEntry.expiresAt
}
```

In practice, `getOrDefault()` covers ~95 % of read sites and you don't need to make this distinction. If you do, prefer **explicit invalidation** ([Invalidation](./invalidation.md)) over inferring from errors.

## A `hasInCache` helper

If you just want a boolean check without reading the value:

```typescript
import { NcachedService, NcachedServiceErrors } from 'ng-ncached';

export function hasInCache(
  cache: NcachedService,
  ...keys: string[]
): boolean {
  try {
    cache.get(...keys);
    return true;
  } catch (error) {
    if (
      error instanceof NcachedServiceErrors.KeyNotFound ||
      error instanceof NcachedServiceErrors.MapNotFound ||
      error instanceof NcachedServiceErrors.ValueNotFound
    ) {
      return false;
    }
    throw error;
  }
}
```

## What's next?

- **[Caching observables](./caching-observables.md)** — the built-in pattern for read-through HTTP caching.
- **[API Reference](../api/errors.md)** — every error type, full message and constructor signature.
