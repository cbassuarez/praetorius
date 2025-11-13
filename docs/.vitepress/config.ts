import { defineConfig } from 'vitepress'

const REPO = 'cbassuarez/praetorius'

export default defineConfig({
  lang: 'en-US',
  title: 'Praetorius',
  description: 'Interactive works console with synchronized audio + page-follow PDFs.',
  lastUpdated: true,
  cleanUrls: true,
  appearance: 'light', // default light per preference
  base: '/praetorius/', // project page on GitHub Pages

  head: [
    ['meta', { name: 'theme-color', content: '#ffffff' }],
    ['meta', { property: 'og:site_name', content: 'Praetorius' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:title', content: 'Praetorius — Interactive Works Console' }],
    ['meta', { property: 'og:description', content: 'Score-centric works pages with page-follow PDFs and audio sync.' }],
  ],

  themeConfig: {
    logo: { src: '/logo.svg', alt: 'Praetorius' },

    nav: [
      { text: 'Home', link: '/' },
      { text: 'Docs', link: '/docs/getting-started' },
      { text: 'Playground', link: '/playground' },
      { text: 'Showcase', link: '/showcase' },
      { text: 'Changelog', link: '/changelog' }
    ],

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

    search: {
      provider: 'algolia',
      options: {
        appId: 'YOUR_APP_ID',
        apiKey: 'YOUR_SEARCH_API_KEY',
        indexName: 'praetorius',
        insights: true,
        placeholder: 'Search docs…'
      }
    },

    footer: {
      message: 'MIT Licensed',
      copyright: '© Praetorius contributors'
    },

    lastUpdatedText: 'Last updated'
  },

  vite: {
    optimizeDeps: { include: ['pdfjs-dist'] }
  }
})
