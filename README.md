<p align="center">
   <img src="https://iili.io/2StGF3l.th.png" alt="ng-ncached logo">
</p>

<p align="center">
   <a href="https://www.npmjs.com/package/ng-ncached"><img src="https://img.shields.io/npm/v/ng-ncached.svg" alt="npm version"></a>
   <a href="https://github.com/AndreaAlhena/ncached/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/ng-ncached.svg" alt="license"></a>
   <a href="https://ng-ncached.andreatantimonaco.me"><img src="https://img.shields.io/badge/docs-ng--ncached.andreatantimonaco.me-blue" alt="docs"></a>
</p>

# ng-ncached

A lightweight, hierarchical in-memory cache for Angular with TTL, Observable integration, request deduplication, and **opt-in localStorage persistence with pluggable compression**.

📚 **Full documentation:** [ng-ncached.andreatantimonaco.me](https://ng-ncached.andreatantimonaco.me)

## Install

```bash
npm install ng-ncached
```

## Quick start

`NcachedService` is provided in root — just inject it:

```typescript
import { Component, inject } from '@angular/core';
import { NcachedService } from 'ng-ncached';

@Component({ /* ... */ })
export class MyComponent {
  private readonly _cache = inject(NcachedService);

  ngOnInit(): void {
    this._cache.set({ name: 'Alice' }, 'users', 'current');
    const user = this._cache.get<{ name: string }>('users', 'current');
    // => { name: 'Alice' }
  }
}
```

## Enable localStorage persistence (optional)

The cache is in-memory only by default. To make it survive page reloads, opt in via `provideNcachedConfig` in your app providers — optionally with a compressor to shrink the snapshot:

```typescript
// app.config.ts
import { ApplicationConfig } from '@angular/core';
import { LzStringCompressor, provideNcachedConfig } from 'ng-ncached';

export const appConfig: ApplicationConfig = {
  providers: [
    provideNcachedConfig({
      persistence: {
        enabled: true,
        compressor: new LzStringCompressor(), // optional, defaults to NoopCompressor
      },
    }),
  ],
};
```

→ See the [docs](https://ng-ncached.andreatantimonaco.me) for guides on TTL, Observable caching, persistence, compression, the full API reference, and more.

## License

[MIT](./LICENSE)
