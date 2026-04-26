---
id: persistence-and-compression
title: Persistence & compression
sidebar_position: 7
---

# Persistence & compression

Persistence makes the cache **survive page reloads**. It's an opt-in: by default, `ng-ncached` is purely in-memory.

When enabled, the cache is:

- **Hydrated** from `localStorage` once, at service construction time.
- **Persisted** back to `localStorage` on the `beforeunload` event.

You can plug in a **compressor** to shrink the snapshot — useful when you bump up against `localStorage`'s ~5 MB per-origin limit.

## Enabling persistence

Use `provideNcachedConfig()` in your app's providers:

```typescript
// app.config.ts (standalone)
import { ApplicationConfig } from '@angular/core';
import { provideNcachedConfig } from 'ng-ncached';

export const appConfig: ApplicationConfig = {
  providers: [
    provideNcachedConfig({
      persistence: {
        enabled: true,
      },
    }),
  ],
};
```

That's enough to enable hydration + auto-save under the default storage key (`ncached_snapshot`). On the next reload, anything in the cache that hasn't expired comes back.

## A custom storage key

```typescript
provideNcachedConfig({
  persistence: {
    enabled: true,
    storageKey: 'my_app_cache_v1',
  },
})
```

Tip: bake a version suffix into the key so you can ship a "drop everything cached on the old shape" change just by bumping the suffix.

## What gets persisted

The whole `ICacheObject` tree is serialised to JSON, with `Map` instances converted to a `{ __mapEntries: [...] }` shape and reconstructed on hydration. Two things to know:

1. **Expired entries are dropped during serialisation** — they never bloat the snapshot.
2. **Expired entries are also dropped during hydration** — entries that aged out while the tab was closed simply don't come back.

Anything that doesn't survive `JSON.stringify` (functions, class instances with methods, `Date`, circular refs) won't round-trip. For pure in-memory use without persistence enabled, this caveat doesn't apply.

## Lifecycle

| Event             | What happens                                                                          |
|-------------------|---------------------------------------------------------------------------------------|
| Service injection | `_hydrate()` runs once. Reads & decompresses `localStorage`, restores Maps, drops expired entries. On any failure (no entry / bad JSON / decompression error), starts with an empty cache. |
| `beforeunload`    | `_persist()` runs. Serialises + compresses the whole cache and writes to `localStorage`. `QuotaExceededError` is caught and logged via `console.warn`. |
| `clearAll()`      | Wipes in-memory cache **and** removes the `localStorage` entry.                       |

There's no per-write persistence — saving on every `set()` would be expensive and would block on the synchronous `localStorage` API. The `beforeunload` strategy keeps writes free.

:::warning
`beforeunload` doesn't fire for hard crashes, force-quits, or some mobile background-kill scenarios. Treat persistence as a **best-effort optimisation**, not a durable store.
:::

## Compression

Persisted data passes through an `ICompressor` on the way to / from `localStorage`. Two implementations ship out of the box:

| Compressor            | When to use it                                                                  |
|-----------------------|---------------------------------------------------------------------------------|
| `NoopCompressor`      | Default. No compression. Best for small caches or for debugging — the snapshot is human-readable in DevTools. |
| `LzStringCompressor`  | Wraps [lz-string](https://github.com/pieroxy/lz-string) UTF-16 encoding. Cuts JSON snapshots roughly in half on real-world data, with low CPU cost. Recommended for non-trivial caches. |

### Using `LzStringCompressor`

```typescript
import { provideNcachedConfig, LzStringCompressor } from 'ng-ncached';

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

No other change needed — the next reload will read & write through the compressor automatically.

:::note
**Synchronous-only contract.** Compressors must be synchronous because they run inside a `beforeunload` handler, which doesn't tolerate async work. `compress()` and `decompress()` both return `string` — no Promises.
:::

### Custom compressor

Implement [`ICompressor`](../api/compressors.md#icompressor):

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

(Base64 is **not** a real compression — it's an example of how to plug in an arbitrary transform. For actual compression, use `LzStringCompressor` or wrap something like `pako`.)

## Real-world example: full setup with versioned key + compression

```typescript
// app.config.ts
import { ApplicationConfig } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { LzStringCompressor, provideNcachedConfig } from 'ng-ncached';
import { routes } from './app.routes';

const APP_CACHE_VERSION = 'v2';

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(),
    provideRouter(routes),
    provideNcachedConfig({
      persistence: {
        enabled: true,
        storageKey: `app_cache_${APP_CACHE_VERSION}`,
        compressor: new LzStringCompressor(),
      },
    }),
  ],
};
```

## Inspecting the snapshot

With `NoopCompressor` you can read the snapshot directly in DevTools → Application → Local Storage:

```json
{
  "users": {
    "__mapEntries": [
      ["currentName", { "value": "Alice", "expiresAt": null }]
    ]
  }
}
```

With `LzStringCompressor` you'll see UTF-16 noise — to inspect, paste into [lz-string's online demo](https://pieroxy.net/blog/pages/lz-string/demo.html) and pick `decompressFromUTF16`.

## Disabling persistence at runtime

There's no toggle — persistence is configured at injector level. To "disable" it:

- Don't call `provideNcachedConfig()` (or pass `{ persistence: { enabled: false } }`).
- For sign-out / reset flows, call `cache.clearAll()` to wipe both memory and `localStorage`.

## What's next?

- **[Configuration](./configuration.md)** — full `INcachedConfig` reference.
- **[Compressors API](../api/compressors.md)** — `ICompressor`, `NoopCompressor`, `LzStringCompressor`.
