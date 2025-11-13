import { defineConfig } from 'vitepress'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/** Repo + paths */
const REPO = 'cbassuarez/praetorius'
const here = path.dirname(fileURLToPath(import.meta.url)) // .../website/docs/.vitepress
const componentsDir = path.resolve(here, '../components')

/** DocSearch env (set these in CI to enable Algolia; otherwise we use local search) */
const DOCSEARCH_APP_ID     = process.env.DOCSEARCH_APP_ID     || process.env.ALGOLIA_APP_ID     || ''
const DOCSEARCH_API_KEY    = process.env.DOCSEARCH_API_KEY    || process.env.ALGOLIA_API_KEY    || ''
const DOCSEARCH_INDEX_NAME = process.env.DOCSEARCH_INDEX_NAME || 'praetorius'
const hasDocSearch = !!(DOCSEARCH_APP_ID && DOCSEARCH_API_KEY)

export default defineConfig({
  lang: 'en-US',
  title: 'Praetorius',
  description: 'Interactive works console with synchronized audio + page-follow PDFs.',
  lastUpdated: true,
  cleanUrls: true,
  appearance: 'light',
  base: '/praetorius/',
  outDir: './.vitepress/dist',

  head: [
    ['meta', { name: 'theme-color', content: '#ffffff' }],
    ['meta', { property: 'og:site_name', content: 'Praetorius' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:title', content: 'Praetorius — Interactive Works Console' }],
    ['meta', { property: 'og:description', content: 'Score-centric works pages with page-follow PDFs and audio sync.' }],
  ],

  themeConfig: {

    nav: [
      { text: 'Home', link: '/' },
      { text: 'Docs', link: '/docs/getting-started' },
      { text: 'Playground', link: '/playground' },
      { text: 'Showcase', link: '/showcase' },
      { text: 'Changelog', link: '/changelog' }
    ],

    /** Sidebar:
     * - Keep full docs sidebar for /docs/*
     * - Add a root-level sidebar so pages like /playground show a left nav
     */
    sidebar: {
      '/docs/': [
        {
          text: 'Getting Started',
          items: [
            { text: 'Install & First Page', link: '/docs/getting-started' },
            { text: 'CLI Reference', link: '/docs/cli' }
          ]
        },
        {
          text: 'Core Concepts',
          items: [
            { text: 'Skins', link: '/docs/skins/' },
            { text: 'Works Data (Schema)', link: '/docs/works-data' },
            { text: 'PDF & Audio (Page-Follow)', link: '/docs/pdf-audio' },
            { text: 'Embedding (Squarespace & Static)', link: '/docs/embedding' },
            { text: 'URL Deep-Link Spec', link: '/docs/url-deeplink' },
          ]
        },
        {
          text: 'Use Cases',
          items: [
            { text: 'For Festivals & Universities', link: '/use-cases/festivals-universities' },
            { text: 'For Libraries & Galleries', link: '/use-cases/libraries-galleries' },
          ]
        },
        {
          text: 'Guides',
          items: [
            { text: 'Recipes', link: '/docs/recipes' },
            { text: 'Troubleshooting', link: '/docs/troubleshooting' },
            { text: 'Contribute', link: '/docs/contribute' },
            { text: 'Archive (v0.1)', link: '/docs/archive-v0-1' },
          ]
        }
      ],
      '/': [
        {
          text: 'Site',
          items: [
            { text: 'Playground', link: '/playground' },
            { text: 'Showcase',  link: '/showcase'  },
            { text: 'Changelog', link: '/changelog' }
          ]
        }
      ]
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/cbassuarez/praetorius' },
      { icon: 'npm', link: 'https://www.npmjs.com/package/praetorius' }
    ],

    editLink: {
      pattern: `https://github.com/${REPO}/edit/main/docs/:path`,
      text: 'Edit this page on GitHub'
    },

    /** Search:
     * Fallback to local search if DocSearch creds aren’t present
     * (prevents a “completely broken” search UI on prod).
     */
    search: hasDocSearch
      ? {
          provider: 'algolia',
          options: {
            appId: DOCSEARCH_APP_ID,
            apiKey: DOCSEARCH_API_KEY,
            indexName: DOCSEARCH_INDEX_NAME,
            insights: true,
            placeholder: 'Search docs…'
          }
        }
      : {
          provider: 'local'
        },

    footer: {
      message: 'MIT Licensed',
      copyright: '© Praetorius contributors'
    },

    lastUpdatedText: 'Last updated'
  },

  vite: {
    optimizeDeps: { include: ['pdfjs-dist'] },
    resolve: { alias: { '@components': componentsDir } },
    build: { chunkSizeWarningLimit: 1024 }
  }
})
