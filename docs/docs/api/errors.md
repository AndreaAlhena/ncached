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

## Recommended handling

For the recommended `instanceof`-based discrimination pattern and ready-made `getOrDefault` / `hasInCache` helpers, see [Error handling](../guides/error-handling.md).
