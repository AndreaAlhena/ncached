---
id: configuration
title: Configuration
sidebar_position: 8
---

# Configuration

`ng-ncached` works with **zero configuration** out of the box — just inject `NcachedService`. Configuration only kicks in when you want **persistence**.

## The `provideNcachedConfig()` provider

The standard way to configure the library is via `provideNcachedConfig()`, which wires up the `NCACHED_CONFIG` injection token under the hood:

```typescript
// app.config.ts
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

Or in a classic `NgModule`:

```typescript
// app.module.ts
import { NgModule } from '@angular/core';
import { provideNcachedConfig } from 'ng-ncached';

@NgModule({
  providers: [
    provideNcachedConfig({
      persistence: {
        enabled: true,
      },
    }),
  ],
})
export class AppModule {}
```

## The `INcachedConfig` shape

```typescript
interface INcachedConfig {
  persistence?: {
    enabled: boolean;
    storageKey?: string;     // defaults to 'ncached_snapshot'
    compressor?: ICompressor; // defaults to new NoopCompressor()
  };
}
```

| Field                            | Type                | Default                | Notes                                                                                  |
|----------------------------------|---------------------|------------------------|----------------------------------------------------------------------------------------|
| `persistence`                    | `object?`           | `undefined`            | Omit the whole field for pure in-memory mode.                                          |
| `persistence.enabled`            | `boolean`           | required               | Set `true` to opt in to hydration + `beforeunload` save.                               |
| `persistence.storageKey`         | `string`            | `'ncached_snapshot'`   | The `localStorage` key. Bake a version into it for clean migrations.                    |
| `persistence.compressor`         | `ICompressor`       | `new NoopCompressor()` | Plug in `LzStringCompressor` for non-trivial caches, or your own implementation.       |

See [Persistence & compression](./persistence-and-compression.md) for the why and when of each option.

## Without `provideNcachedConfig()`

If no config is provided, `NcachedService` is injected with `null` (via `@Optional() @Inject(NCACHED_CONFIG)`) and runs in pure in-memory mode. No `beforeunload` listener is registered, no `localStorage` is touched. This is the default — you don't need to do anything to get it.

## Configuring per feature module / per route

`provideNcachedConfig()` returns a standard Angular `Provider`, so it can be placed at any level of the injector tree:

```typescript
// In a route's providers
{
  path: 'admin',
  loadChildren: () => import('./admin/admin.routes'),
  providers: [
    provideNcachedConfig({
      persistence: {
        enabled: true,
        storageKey: 'admin_cache',
      },
    }),
  ],
}
```

But note: `NcachedService` itself is `providedIn: 'root'`, so the **root** injector resolves the config. Re-providing config deeper in the tree won't create a second cache instance — for that you'd need to provide `NcachedService` at that level too. For most apps, root-level config is what you want.

## Using the raw `NCACHED_CONFIG` token

If you have a more complex setup (e.g. computing config asynchronously via `useFactory`), the raw token is exported:

```typescript
import { NCACHED_CONFIG, INcachedConfig } from 'ng-ncached';

{
  provide: NCACHED_CONFIG,
  useFactory: (env: EnvService): INcachedConfig => ({
    persistence: {
      enabled: env.isProduction,
      storageKey: `cache_${env.appVersion}`,
    },
  }),
  deps: [EnvService],
}
```

## What's next?

- **[Persistence & compression](./persistence-and-compression.md)** — the main reason to use config.
- **[Configuration API reference](../api/configuration.md)** — `INcachedConfig`, `NCACHED_CONFIG`, `provideNcachedConfig`.
