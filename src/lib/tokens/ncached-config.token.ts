import { InjectionToken } from '@angular/core';
import { INcachedConfig } from '../interfaces/ncached-config.interface';

/**
 * Injection token for providing ng-ncached configuration.
 *
 * Most consumers should use `provideNcachedConfig()` or
 * `NcachedModule.forRoot()` rather than wiring this token directly.
 * Use the raw token only for advanced cases like `useFactory` providers.
 *
 * @example
 * ```typescript
 * providers: [
 *   {
 *     provide: NCACHED_CONFIG,
 *     useFactory: (env: EnvService) => ({ persistence: { enabled: env.isProduction } }),
 *     deps: [EnvService],
 *   },
 * ]
 * ```
 */
export const NCACHED_CONFIG = new InjectionToken<INcachedConfig>('NcachedConfig');
