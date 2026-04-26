---
id: intro
title: Introduction
slug: /
sidebar_position: 1
---

# Introduction

**ng-ncached** is a lightweight, hierarchical in-memory cache for Angular applications, with TTL expiration, Observable integration, request deduplication and optional `localStorage` persistence with pluggable compression.

It packs the patterns most apps end up reinventing — caching HTTP results, deduplicating concurrent requests, expiring stale data, surviving page reloads — into a single injectable service.

## Highlights

- **Hierarchical cache** — organise data into namespaces and sub-namespaces of any depth, backed by native `Map` instances.
- **TTL on every entry** — pass `{ ttl: ms }` to `set()` and the entry expires automatically.
- **Observable caching** — `cacheObservable()` wraps an HTTP call (or any `Observable`), caches the result, and **deduplicates** concurrent in-flight requests via `shareReplay`.
- **Safe accessors** — `getOrDefault()` never throws; the rest throws **typed** errors you can discriminate with `instanceof`.
- **Invalidation API** — `remove()`, `clear()`, `clearAll()` for fine-grained or full wipes.
- **Optional persistence** — opt in to `localStorage` snapshots on `beforeunload`, with **pluggable compression** (`NoopCompressor`, `LzStringCompressor`, or your own).
- **Tree-shakeable, zero-config** — just inject `NcachedService`. Provided in root.

## When should I use it?

Reach for `ng-ncached` when you want:

- A shared in-memory cache across components and services without each owner reinventing keying / lookup / TTL.
- Deduplication of concurrent HTTP calls hitting the same endpoint at the same time.
- A simple way to make a slice of state survive page reloads, with optional compression to fit more in 5 MB of `localStorage`.

If you need cross-tab synchronisation, IndexedDB, or background workers, that's outside the scope — `ng-ncached` deliberately stays small and predictable.

## What's next?

- **[Getting Started](./getting-started.md)** — install, inject, first cache hit
- **[Setting values](./guides/setting-values.md)** — `set()` basics
- **[TTL & expiration](./guides/ttl-and-expiration.md)** — expire entries automatically
- **[Caching observables](./guides/caching-observables.md)** — wrap HTTP calls, dedupe requests
- **[Invalidation](./guides/invalidation.md)** — `remove`, `clear`, `clearAll`
- **[Persistence & compression](./guides/persistence-and-compression.md)** — survive page reloads
- **[Configuration](./guides/configuration.md)** — `provideNcachedConfig` and `INcachedConfig`
- **[Error handling](./guides/error-handling.md)** — every error type and how to handle it
- **[API Reference](./api/ncached-service.md)** — the full public surface
