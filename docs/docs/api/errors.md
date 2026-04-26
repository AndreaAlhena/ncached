---
id: errors
title: NcachedServiceErrors
sidebar_position: 7
---

# `NcachedServiceErrors`

The namespace containing every error class that `NcachedService` can throw. Use `instanceof` against these to discriminate failures.

```typescript
import { NcachedServiceErrors } from 'ng-ncached';
```

All error classes extend the native `Error` and carry a descriptive `message`.

## `InsufficientsKeysProvidedError`

Thrown by `set()` and `get()` when fewer than two keys are passed.

```typescript
class InsufficientsKeysProvidedError extends Error {
  constructor();
}
```

**Message**

> `Not enough keys provided: you shall provide at least a module and a map key`

**Why** — the API requires at least one namespace key plus one `Map` key. Hitting this almost always means a bug in the call site.

---

## `KeyNotFound`

Thrown by `get()` when a namespace key in the path doesn't exist on the cache object.

```typescript
class KeyNotFound extends Error {
  constructor(key: string);
}
```

**Message**

> `The key <key> doesn't exist in the cache object`

**Why** — you tried to read from a namespace that has never been written to.

---

## `MapNotFound`

Thrown by `get()` when a key in the path exists but resolves to a nested `ICacheObject` instead of a `Map`.

```typescript
class MapNotFound extends Error {
  constructor(key: string);
}
```

**Message**

> `A map has not been found in the cache object for the given <key> key`

**Why** — your read path is shorter than what was actually written. For example, `set('v', 'a', 'b', 'c')` then `get('a', 'b')` — the path `'a' → 'b'` is a namespace, not a `Map`.

---

## `ValueNotFound`

Thrown by `get()` when the path resolves to the right `Map`, but **either**:

- the final key has no entry in the `Map`, **or**
- the entry exists but its `expiresAt` is in the past (TTL exceeded).

When the cause is expiration, `get()` removes the stale entry from the `Map` before throwing — there's no need to clean up.

```typescript
class ValueNotFound extends Error {
  constructor(key: string);
}
```

**Message**

> `A value has not been found in the Map for the given <key> key`

**Why** — a true cache miss, or an expired entry. The error type is the same; if you need to distinguish, see the note in [Error handling](../guides/error-handling.md#distinguishing-expired-from-never-seen).

---

## `UncloneableValueError`

Thrown by `set()` (when the value being stored cannot be deep-cloned) and by `get()` / `getOrDefault()` / the cache-hit branch of `cacheObservable()` (when the value being read cannot be deep-cloned). Since v1.1.0 the cache always defensively clones values via `structuredClone`, so any value that `structuredClone` rejects surfaces here as a typed error instead of silently leaking a reference.

Typical causes: functions, DOM nodes, class instances with private fields, or other host-defined objects `structuredClone` doesn't know how to copy.

```typescript
class UncloneableValueError extends Error {
  constructor(key: string, cause: unknown);
}
```

**Message**

> `The value for key "<key>" cannot be cloned by structuredClone — typically caused by functions, DOM nodes, or class instances with private fields`

The original platform error (typically a `DataCloneError`) is preserved on the `cause` property for debugging.

**Why** — the cache enforces immutability by deep-cloning in and out. If the value you're caching isn't structured-clone-compatible, the library tells you loudly rather than letting your data quietly desynchronise.

---

## Recommended handling

For the recommended `instanceof`-based discrimination pattern and ready-made `getOrDefault` / `hasInCache` helpers, see [Error handling](../guides/error-handling.md).
