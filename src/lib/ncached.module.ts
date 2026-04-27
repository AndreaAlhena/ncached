import { ModuleWithProviders, NgModule } from '@angular/core';
import { INcachedConfig } from './interfaces/ncached-config.interface';
import { provideNcachedConfig } from './provide-ncached';

/**
 * NgModule wrapper around `provideNcachedConfig()` for Angular 12-13 consumers
 * (or any project still using the NgModule-based bootstrap).
 *
 * Standalone projects on Angular 14+ should prefer `provideNcachedConfig()`
 * directly in their `ApplicationConfig` or `bootstrapApplication` call.
 *
 * @example
 * ```typescript
 * @NgModule({
 *   imports: [
 *     NcachedModule.forRoot({ persistence: { enabled: true } }),
 *   ],
 * })
 * export class AppModule {}
 * ```
 */
// @dynamic
@NgModule({})
export class NcachedModule {
  /**
   * Configure ng-ncached at the root injector level.
   *
   * @param config - The ncached configuration
   * @returns A ModuleWithProviders ready to be added to your AppModule's imports
   */
  public static forRoot(config: INcachedConfig): ModuleWithProviders<NcachedModule> {
    return {
      ngModule: NcachedModule,
      providers: [provideNcachedConfig(config)],
    };
  }
}
