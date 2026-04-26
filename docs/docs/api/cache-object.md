---
id: cache-object
title: ICacheObject
sidebar_position: 4
---

# `ICacheObject`

The recursive shape of the internal cache hierarchy. Exported for advanced use cases — most consumers never need to import it.

```typescript
import { ICacheObject } from 'ng-ncached';

interface ICacheObject {
  [k: string]: Map<string, ICacheEntry<any>> | ICacheObject;
}
```

Every key resolves to **either**:

- a `Map<string, ICacheEntry<any>>` — a leaf node holding wrapped values, **or**
- another `ICacheObject` — a deeper namespace.

This is what enables arbitrary nesting via `set('value', 'a', 'b', 'c', 'd')`.

The `Map` value type is [`ICacheEntry`](./cache-entry.md), the wrapper that holds the value plus its `expiresAt` timestamp. `get()` unwraps this for you.

## When would I use it?

You typically don't. The two situations where `ICacheObject` is useful:

1. **Writing a custom helper** that operates on the cache structure (e.g. a debug dumper or a custom serialiser).
2. **Strongly typing a function signature** that wraps `NcachedService` internals.

For everyday usage, prefer the public methods on [`NcachedService`](./ncached-service.md).
