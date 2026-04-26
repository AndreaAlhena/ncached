---
id: compressors
title: Compressors
sidebar_position: 6
---

# Compressors

Pluggable compression for the [persistence layer](../guides/persistence-and-compression.md). Three exports: the interface, and two ready-made implementations.

```typescript
import { ICompressor, NoopCompressor, LzStringCompressor } from 'ng-ncached';
```

## `ICompressor`

```typescript
interface ICompressor {
  compress(data: string): string;
  decompress(data: string): string;
}
```

Both methods take and return a `string`. Implementations **must be synchronous** — the persist step runs inside a `beforeunload` handler, which doesn't tolerate async work, so neither method can return a `Promise`.

| Method                | Signature                  | Notes                                                                                  |
|-----------------------|----------------------------|----------------------------------------------------------------------------------------|
| `compress(data)`      | `(string) => string`       | Called once per `beforeunload` save.                                                   |
| `decompress(data)`    | `(string) => string`       | Called once per service construction (during hydration).                               |

If `decompress()` throws, hydration silently falls back to an empty cache — there's no crash, but the previous snapshot is lost.

## `NoopCompressor`

```typescript
class NoopCompressor implements ICompressor {
  compress(data: string): string;   // returns data unchanged
  decompress(data: string): string; // returns data unchanged
}
```

The default. Stores the cache as **plain JSON** in `localStorage`, which is human-readable in DevTools.

**Use it when:**

- Your cache is small (under ~100 KB serialised).
- You're debugging persistence and want to inspect the snapshot.

## `LzStringCompressor`

```typescript
class LzStringCompressor implements ICompressor {
  compress(data: string): string;   // LZString.compressToUTF16(data)
  decompress(data: string): string; // LZString.decompressFromUTF16(data) ?? ''
}
```

Wraps [lz-string](https://github.com/pieroxy/lz-string)'s UTF-16 encoding. Cuts JSON snapshots roughly in half on real-world data, with very low CPU cost (synchronous, microseconds for typical payloads).

**Use it when:**

- Your cache is non-trivial (over ~100 KB serialised).
- You're approaching `localStorage`'s ~5 MB per-origin limit.

Decompression returns `''` on invalid input (lz-string returns `null` in that case; the wrapper coerces it to an empty string so deserialisation can fail gracefully).

**Example**

```typescript
import { ApplicationConfig } from '@angular/core';
import { LzStringCompressor, provideNcachedConfig } from 'ng-ncached';

export const appConfig: ApplicationConfig = {
  providers: [
    provideNcachedConfig({
      persistence: {
        enabled: true,
        compressor: new LzStringCompressor(),
      },
    }),
  ],
};
```

## Custom compressor

Any class implementing `ICompressor` works:

```typescript
import { ICompressor } from 'ng-ncached';

export class Base64Compressor implements ICompressor {
  compress(data: string): string {
    return btoa(unescape(encodeURIComponent(data)));
  }

  decompress(data: string): string {
    return decodeURIComponent(escape(atob(data)));
  }
}
```

Then provide it:

```typescript
provideNcachedConfig({
  persistence: {
    enabled: true,
    compressor: new Base64Compressor(),
  },
})
```

(Base64 is **not** real compression — this is just an illustrative example. For production, use `LzStringCompressor` or wrap something like `pako`.)

See [Persistence & compression](../guides/persistence-and-compression.md) for the broader context.
