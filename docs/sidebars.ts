import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docsSidebar: [
    'intro',
    'getting-started',
    {
      type: 'category',
      label: 'Guides',
      collapsed: false,
      link: {
        type: 'generated-index',
        title: 'Guides',
        description: 'Practical, copy-pasteable recipes for using ng-ncached in real Angular apps.',
        slug: '/guides',
      },
      items: [
        'guides/setting-values',
        'guides/getting-values',
        'guides/nested-namespaces',
        'guides/ttl-and-expiration',
        'guides/invalidation',
        'guides/caching-observables',
        'guides/persistence-and-compression',
        'guides/configuration',
        'guides/error-handling',
      ],
    },
    {
      type: 'category',
      label: 'API Reference',
      collapsed: false,
      link: {
        type: 'generated-index',
        title: 'API Reference',
        description: 'The full public surface of ng-ncached.',
        slug: '/api',
      },
      items: [
        'api/ncached-service',
        'api/options',
        'api/cache-entry',
        'api/cache-object',
        'api/configuration',
        'api/compressors',
        'api/errors',
      ],
    },
    'changelog',
  ],
};

export default sidebars;
