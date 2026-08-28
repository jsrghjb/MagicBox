import { resolve } from 'node:path'
import { defineConfig } from 'vitepress'
import { withSidebar } from 'vitepress-sidebar'
import { withI18n } from 'vitepress-i18n'

export const appName = '魔法百宝箱'
export const appDescription = 'Local Android mirroring and toolbox.'

export const defaultLocale = 'en'
export const locales = [defaultLocale, 'zhHans']

const viteConfig = {
  server: {
    port: 1127,
  },
  resolve: {
    alias: {
      $root: resolve(),
      $docs: resolve('docs'),
    },
  },
}

const vueConfig = {
  template: {
    compilerOptions: {
      isCustomElement: (tag = '') => ['amp-ad', 'ins'].includes(tag),
    },
  },
}

const vitePressConfig = {
  title: appName,
  description: appDescription,
  head: [
    ['link', { rel: 'icon', href: '/images/logo.ico' }],
  ],

  outDir: '../dist-docs',

  cleanUrls: true,
  lastUpdated: true,

  themeConfig: {
    logo: { src: '/images/logo.ico', alt: appName },
    socialLinks: [
      {
        icon: 'github',
        link: 'https://github.com/jsrghjb/MagicBox',
      },
    ],
    footer: {
      copyright: `Copyright © ${new Date().getFullYear()} 万象`,
    },
  },

  rewrites: {
    'en/:rest*': ':rest*',
  },

  sitemap: {
    hostname: 'https://github.com/jsrghjb/MagicBox',
  },

  vite: viteConfig,

  vue: vueConfig,
}

const vitePressI18nConfig = {
  locales,
  rootLocale: defaultLocale,
  searchProvider: 'local',
  description: {
    en: 'Local Android mirroring and toolbox.',
    zhHans: '本地图形化 Android 投屏管理与工具箱',
  },
  themeConfig: {
    en: {
      nav: [
        { text: 'Guide', link: '/guide' },
        { text: 'Reference', link: '/reference' },
        { text: 'Help', link: '/help' },
        { text: 'Changelog', link: '/changelog' },
        { text: 'Contact', link: '/contact' },
      ],
    },
    zhHans: {
      nav: [
        { text: '指南', link: '/zhHans/guide' },
        { text: '参考', link: '/zhHans/reference' },
        { text: '帮助', link: '/zhHans/help' },
        { text: '更新日志', link: '/zhHans/changelog' },
        { text: '联系', link: '/zhHans/contact' },
      ],
    },
  },
}

const vitePressSidebarConfig = [
  ...locales.map(lang => ({
    ...(defaultLocale === lang
      ? { basePath: '/', resolvePath: '/' }
      : { basePath: `/${lang}/`, resolvePath: `/${lang}/` }),
    documentRootPath: `/docs/${lang}`,
    collapsed: false,
    useTitleFromFrontmatter: true,
    capitalizeFirst: true,
    useFolderLinkFromIndexFile: true,
    includeFolderIndexFile: false,
    useFolderTitleFromIndexFile: true,
    manualSortFileNameByPriority: ['index.md', 'guide', 'reference', 'help', 'changelog.md', 'contact.md', 'started.md', 'milestones.md'],
  })),
]

// https://vitepress.dev/reference/site-config
export default defineConfig(
  // @ts-ignore
  withSidebar(withI18n(vitePressConfig, vitePressI18nConfig), vitePressSidebarConfig),
)
