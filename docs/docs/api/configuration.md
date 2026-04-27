---
id: configuration
title: Configuration
sidebar_position: 5
---

# Configuration

Four exports drive configuration: an interface, an injection token, a standalone provider factory, and an `NgModule` for legacy projects.

```typescript
import {
  INcachedConfig,
  NCACHED_CONFIG,
  NcachedModule,
  provideNcachedConfig,
} from 'ng-ncached';
```

## `INcachedConfig`

```typescript
interface INcachedConfig {
  persistence?: {
    enabled: boolean;
    storageKey?: string;
    compressor?: ICompressor;
  };
}
```

| Field                        | Type                | Default                 | Notes                                                                                  |
|------------------------------|---------------------|-------------------------|----------------------------------------------------------------------------------------|
| `persistence`                | `object?`           | `undefined`             | Omit for pure in-memory mode.                                                          |
| `persistence.enabled`        | `boolean`           | required                | `true` opts in to hydration + `beforeunload` save.                                     |
| `persistence.storageKey`     | `string?`           | `'ncached_snapshot'`    | The `localStorage` key. Bake a version into it for clean migrations.                   |
| `persistence.compressor`     | `ICompressor?`      | `new NoopCompressor()`  | Plug in `LzStringCompressor` or your own. See [Compressors](./compressors.md).         |

## `NCACHED_CONFIG`

```typescript
export const NCACHED_CONFIG: InjectionToken<INcachedConfig>;
```

The Angular `InjectionToken` consumed by `NcachedService`. The service injects it as `@Optional() @Inject(NCACHED_CONFIG) config: INcachedConfig | null` — when the token isn't provided, the service runs in pure in-memory mode.

You'll usually wire this up via `provideNcachedConfig()`, but the raw token is exported for advanced cases like `useFactory`:

```typescript
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

## provideNcachedConfig

```typescript
function provideNcachedConfig(config: INcachedConfig): Provider;
```

A small convenience function that returns `{ provide: NCACHED_CONFIG, useValue: config }`. Use it in the `providers` array of your `ApplicationConfig`, `NgModule`, or route config.

**Example**

```typescript
import { ApplicationConfig } from '@angular/core';
import { LzStringCompressor, provideNcachedConfig } from 'ng-ncached';

export const appConfig: ApplicationConfig = {
  providers: [
    provideNcachedConfig({
      persistence: {
        enabled: true,
        storageKey: 'app_cache_v1',
        compressor: new LzStringCompressor(),
      },
    }),
  ],
};
```

## `NcachedModule`

```typescript
class NcachedModule {
  static forRoot(config: INcachedConfig): ModuleWithProviders<NcachedModule>;
}
```

NgModule wrapper around `provideNcachedConfig()` for Angular 12-13 consumers (or any project still using the classic NgModule-based bootstrap). `forRoot()` delegates to `provideNcachedConfig()` under the hood, so both entry points produce identical runtime behaviour.

**Example**

```typescript
import { NgModule } from '@angular/core';
import { LzStringCompressor, NcachedModule } from 'ng-ncached';

@NgModule({
  imports: [
    NcachedModule.forRoot({
      persistence: {
        enabled: true,
        compressor: new LzStringCompressor(),
      },
    }),
  ],
})
export class AppModule {}
```

See [Configuration guide](../guides/configuration.md) for full setup walkthroughs and [Persistence & compression](../guides/persistence-and-compression.md) for what each option actually does at runtime.
