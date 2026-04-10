import { InjectionToken, Provider } from '@angular/core';
import { INcachedConfig } from '../interfaces/ncached-config.interface';

/**
 * Injection token for providing ncached configuration.
 *
 * @example
 * ```typescript
 * providers: [provideNcachedConfig({ persistence: { enabled: true } })]
 * ```
 */
export const NCACHED_CONFIG = new InjectionToken<INcachedConfig>('NcachedConfig');

/**
 * Convenience function to provide ncached configuration.
 *
 * @param config - The ncached configuration
 * @returns An Angular provider for the NCACHED_CONFIG token
 */
export function provideNcachedConfig(config: INcachedConfig): Provider {
  return { provide: NCACHED_CONFIG, useValue: config };
}
