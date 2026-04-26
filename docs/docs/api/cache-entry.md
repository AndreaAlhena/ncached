---
id: cache-entry
title: ICacheEntry
sidebar_position: 3
---

# `ICacheEntry<T>`

The internal wrapper around every cached value. You won't usually interact with it directly — `get()` unwraps `value` for you — but it's part of the public surface for advanced use cases (custom serialisation, debug tooling).

```typescript
import { ICacheEntry } from 'ng-ncached';

interface ICacheEntry<T> {
  value: T;
  expiresAt: number | null;
}
```

| Field        | Type             | Notes                                                                                  |
|--------------|------------------|----------------------------------------------------------------------------------------|
| `value`      | `T`              | The user-supplied value passed to `set()`.                                             |
| `expiresAt`  | `number \| null` | Epoch timestamp (ms) when this entry expires. `null` means "never expires".            |

## When does `expiresAt` get set?

- `set(value, ...keys)` — no options → `expiresAt: null`.
- `set(value, ...keys, { ttl: ms })` → `expiresAt: Date.now() + ms`.
- `cacheObservable(source, { ttl: ms }, ...keys)` — same as `set()`.

## How is it used internally?

`get()` and `getOrDefault()` check `Date.now() > entry.expiresAt`. If true, they delete the entry from the underlying `Map` and treat the lookup as a miss.

During [persistence](../guides/persistence-and-compression.md):

- **On serialise:** expired entries are filtered out, so they don't bloat the snapshot.
- **On hydrate:** expired entries are filtered out again, so a tab reopened after a long sleep starts clean.

## Reading `ICacheEntry` directly

`get()` returns the unwrapped `value`, never the entry. To inspect the wrapper (typically for debugging), you'd need to reach into the internal `_cache` — possible via TypeScript casts, but **not** part of the supported API.
