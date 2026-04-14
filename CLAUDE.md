# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**ncached** is an Angular 19 library that provides a hierarchical, namespace-based caching service. It uses a recursive `Map<string, T>` structure organized by module/service keys, requiring a minimum of 2 keys for all operations (namespace + lookup key).

This is a library project inside an Angular workspace (`ng-workspace`). It is **not** a standalone app.

## Commands

All commands must be run from the workspace root (`C:\Users\andre\Code\ng-workspace`), not from the project directory.

```bash
# Build (production)
ng build ncached

# Build (development, with declaration maps)
ng build ncached --configuration development

# Run tests (Karma + Jasmine)
ng test ncached

# Run tests once (CI mode, no watch)
ng test ncached --no-watch
```

There is no linter configured. There is no CI pipeline.

## Architecture

### Public API (`src/public-api.ts`)

Two-method surface on `NcachedService` (providedIn: root):
- `get<T>(...keys: string[]): T` -- retrieve a cached value
- `set<T>(value: T, ...keys: string[]): void` -- store a value

Keys work like a path: all keys except the last navigate the `ICacheObject` hierarchy; the last key is the Map lookup key. Minimum 2 keys required.

### Core Data Structure

```
ICacheObject  (recursive: { [k: string]: Map<string, any> | ICacheObject })
  └── "moduleName" -> Map<string, T>
       └── "propertyKey" -> value
```

`_setInCache` auto-creates Maps on first write. `_findMap` navigates the hierarchy on reads and throws if the path doesn't exist.

### Error Handling (`CacheServiceErrors` namespace)

Four error classes in a TypeScript namespace, each thrown at a specific failure point:
- `InsufficientsKeysProvidedError` -- fewer than 2 keys
- `KeyNotFound` -- navigation key missing from ICacheObject
- `MapNotFound` -- navigation key doesn't point to a Map
- `ValueNotFound` -- final lookup key missing from the Map

### Source Layout

```
src/lib/
  interfaces/     ICacheObject
  namespaces/     CacheServiceErrors (4 error classes)
  services/       NcachedService + spec
```

### Testing Patterns

Tests access private methods via `(service as any)._methodName` for direct error-path testing. Public API tests use `set` then `get` round-trips. The service is obtained through Angular's `TestBed.inject`.
