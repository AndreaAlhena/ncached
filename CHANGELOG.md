# Changelog

All notable changes to this project will be documented in this file.

This project follows [Semantic Versioning](https://semver.org/).

---

## [1.0.0] - 2026-04-14

First stable release. The public API is considered stable.

### Added

- **TTL / expiration support** — `set()` now accepts an optional `ISetOptions` object as the
  last argument with a `ttl` field (milliseconds). Cached values are internally wrapped in
  `ICacheEntry<T>` with an `expiresAt` timestamp. Expired entries are automatically removed
  from the Map on access via `get()`.

- **`getOrDefault(defaultValue, ...keys)`** — safe cache access that returns `defaultValue`
  instead of throwing when the key is missing or expired.

- **Invalidation API**
  - `remove(...keys)` — removes a specific cache entry. No-op if the path doesn't exist.
  - `clear(...keys)` — deletes an entire subtree or map layer. No-op if the path doesn't exist.
  - `clearAll()` — wipes the entire in-memory cache (and localStorage entry if persistence is enabled).

- **`cacheObservable(source, options, ...keys)`** — caches the result of an Observable (typically
  an HTTP call). Returns the cached value immediately on cache hit. On cache miss, subscribes to
  the source, stores the result with optional TTL, and emits it. Supports `defaultValue` fallback
  on source error.

- **Request deduplication** — concurrent calls to `cacheObservable()` with the same keys share a
  single source subscription via `shareReplay`. N callers = 1 HTTP request.

- **Persistence layer** (optional, off by default)
  - `INcachedConfig` interface and `NCACHED_CONFIG` injection token for configuration.
  - `provideNcachedConfig()` convenience function for Angular providers.
  - On service construction: hydrates the in-memory cache from localStorage. Expired entries are
    discarded during hydration. Corrupted data results in an empty cache (no crash).
  - On `beforeunload`: serializes the cache to JSON, compresses it via the configured `ICompressor`,
    and writes to localStorage. `QuotaExceededError` is handled gracefully (warning logged, app
    continues).
  - Custom `storageKey` (default: `'ncached_snapshot'`) and `ICompressor` strategy are configurable.

- **Compressors**
  - `ICompressor` interface — synchronous `compress` / `decompress` contract (required for
    `beforeunload` handler compatibility).
  - `NoopCompressor` — passthrough, returns input unchanged. Default when no compressor is configured.
  - `LzStringCompressor` — uses `lz-string`'s `compressToUTF16` / `decompressFromUTF16` for real
    compression optimized for localStorage.

- **New dependency:** `lz-string ^1.5.0`.
- **Peer dependencies:** `@angular/core >=12.0.0`, `@angular/common >=12.0.0`, `rxjs >=7.0.0`.
- MIT license.
- Comprehensive JSDoc with `@example` blocks on all public methods and error classes.
- npm metadata: `description`, `author`, `keywords`, `repository`, `bugs`, `homepage`.

### Fixed

- **Recursive nesting broken for 3+ key depths.** `_findMap` and `_setInCache` used
  `keys.slice(1, keys.length - 1)` which trimmed from both ends, dropping a navigation key on
  each recursive step. Fixed to `keys.slice(1)`. Additionally, `_setInCache` hardcoded
  `this._cache[keys[0]]` in the base case instead of using the `cacheObj` parameter, causing
  deep writes to land at the root level. Auto-creation of intermediate `ICacheObject` nodes
  was also added.
- `ttl: 0` was silently treated as "no expiration" due to a falsy check. Changed to `!= null`
  so that `ttl: 0` correctly produces an immediately-expired entry.
- `set()` now throws `InsufficientsKeysProvidedError` when fewer than 2 string keys remain after
  option parsing, preventing silent undefined-key writes.
- `_setInCache` return type corrected from `ICacheObject | undefined` to `void` (no caller used
  the return value).

### Changed

- Angular peer dependency widened from `>=13.0.0` to `>=12.0.0` (Angular 12 is the lowest version
  whose linker can consume partial Ivy compilation output).
- Consistent code spacing: declarative blocks separated from logic blocks throughout the service.
