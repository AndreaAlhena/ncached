import { Provider } from '@angular/core';
import { INcachedConfig } from './interfaces/ncached-config.interface';
import { NCACHED_CONFIG } from './tokens/ncached-config.token';

/**
 * Convenience function that returns the providers needed to configure ng-ncached.
 * Drop into the providers array of `bootstrapApplication`, an `ApplicationConfig`,
 * an NgModule, or a route — anywhere Angular accepts providers.
 *
 * For Angular 12-13 consumers using NgModules exclusively, prefer
 * `NcachedModule.forRoot(config)` for the more idiomatic shape.
 *
 * @param config - The ncached configuration
 * @returns An Angular provider for the NCACHED_CONFIG token
 *
 * @example
 * ```typescript
 * // Standalone (Angular 14+)
 * bootstrapApplication(AppComponent, {
 *   providers: [
 *     provideNcachedConfig({ persistence: { enabled: true } }),
 *   ],
 * });
 * ```
 */
export function provideNcachedConfig(config: INcachedConfig): Provider {
  return { provide: NCACHED_CONFIG, useValue: config };
}
