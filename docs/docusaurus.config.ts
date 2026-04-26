import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'ng-ncached',
  tagline: 'A simple multi-layer cache service for Angular',
  favicon: 'img/favicon.ico',

  future: {
    v4: true,
  },

  url: 'https://ng-ncached.andreatantimonaco.me',
  baseUrl: '/',

  organizationName: 'AndreaAlhena',
  projectName: 'ncached',
  trailingSlash: false,
  deploymentBranch: 'gh-pages',

  onBrokenLinks: 'throw',

  markdown: {
    hooks: {
      onBrokenMarkdownLinks: 'warn',
    },
  },

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          editUrl:
            'https://github.com/AndreaAlhena/ncached/tree/develop/docs/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: 'img/ncached-social-card.png',
    colorMode: {
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'ng-ncached',
      logo: {
        alt: 'ng-ncached logo',
        src: 'img/logo.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docsSidebar',
          position: 'left',
          label: 'Docs',
        },
        {
          href: 'https://www.npmjs.com/package/ng-ncached',
          label: 'npm',
          position: 'right',
        },
        {
          href: 'https://github.com/AndreaAlhena/ncached',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            {
              label: 'Getting Started',
              to: '/docs/getting-started',
            },
            {
              label: 'Guides',
              to: '/docs/guides/setting-values',
            },
            {
              label: 'API Reference',
              to: '/docs/api/ncached-service',
            },
          ],
        },
        {
          title: 'Community',
          items: [
            {
              label: 'Issues',
              href: 'https://github.com/AndreaAlhena/ncached/issues',
            },
            {
              label: 'Discussions',
              href: 'https://github.com/AndreaAlhena/ncached/discussions',
            },
          ],
        },
        {
          title: 'More',
          items: [
            {
              label: 'GitHub',
              href: 'https://github.com/AndreaAlhena/ncached',
            },
            {
              label: 'npm',
              href: 'https://www.npmjs.com/package/ng-ncached',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Andrea Alhena Tantimonaco. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['bash', 'typescript', 'json'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
