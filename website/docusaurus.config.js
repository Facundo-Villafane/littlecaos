// @ts-check
import {themes as prismThemes} from 'prism-react-renderer';

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'Caos en Mano',
  tagline: 'Roguelike Deckbuilder — Documentación de Diseño',
  favicon: 'img/favicon.ico',

  future: {
    v4: true,
  },

  url: 'https://Facundo-Villafane.github.io',
  baseUrl: '/littlecaos/',

  organizationName: 'Facundo-Villafane',
  projectName: 'littlecaos',
  trailingSlash: false,

  onBrokenLinks: 'warn',

  markdown: {
    hooks: {
      onBrokenMarkdownLinks: 'warn',
      onBrokenMarkdownImages: 'warn',
    },
  },

  i18n: {
    defaultLocale: 'es',
    locales: ['es'],
  },

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          path: '../design',
          exclude: ['CLAUDE.md', 'registry/**', '**/*.yaml'],
          sidebarPath: './sidebars.js',
          editUrl: 'https://github.com/Facundo-Villafane/littlecaos/edit/main/design/',
          showLastUpdateTime: true,
          showLastUpdateAuthor: true,
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      colorMode: {
        defaultMode: 'dark',
        respectPrefersColorScheme: true,
      },
      navbar: {
        title: 'Caos en Mano',
        items: [
          {
            type: 'docSidebar',
            sidebarId: 'designSidebar',
            position: 'left',
            label: 'Docs',
          },
          {
            href: 'https://github.com/Facundo-Villafane/littlecaos',
            label: 'GitHub',
            position: 'right',
          },
        ],
      },
      footer: {
        style: 'dark',
        copyright: `Caos en Mano © ${new Date().getFullYear()} — Documentación de diseño`,
      },
      prism: {
        theme: prismThemes.github,
        darkTheme: prismThemes.dracula,
      },
    }),
};

export default config;
