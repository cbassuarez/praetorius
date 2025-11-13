import DefaultTheme from 'vitepress/theme'
import { h } from 'vue'
import './custom.css'

// Global components available in markdown
import PraeConsoleExact from '@components/PraeConsoleExact.vue'
import GitHubMeta from '@components/GitHubMeta.vue'
import NpmBadge from '@components/NpmBadge.vue'
import GitHubChangelog from '@components/GitHubChangelog.vue'
import CLIBlock from '@components/CLIBlock.vue'
import SchemaViewer from '@components/SchemaViewer.vue'
import ErrorGlossary from '@components/ErrorGlossary.vue'
import SinceBadge from '@components/SinceBadge.vue'
import PraePlayground from '@components/PraePlayground.vue'
import PraeViewer from '@components/PraeViewer.vue'
import PraeConsoleDemo from '@components/PraeConsoleDemo.vue'
import PraeConsoleExact from '@components/PraeConsoleExact.vue'
import NavLogo from './components/NavLogo.vue'

export default {
  ...DefaultTheme,
  Layout() {
    return h(DefaultTheme.Layout, null, {
      'nav-bar-title-before': () => h(NavLogo),
    })
  },
  enhanceApp({ app }) {
    app.component('GitHubMeta', GitHubMeta)
    app.component('NpmBadge', NpmBadge)
    app.component('GitHubChangelog', GitHubChangelog)
    app.component('CLIBlock', CLIBlock)
    app.component('SchemaViewer', SchemaViewer)
    app.component('ErrorGlossary', ErrorGlossary)
    app.component('SinceBadge', SinceBadge)
    app.component('PraePlayground', PraePlayground)
    app.component('PraeViewer', PraeViewer)
    app.component('PraeConsoleDemo', PraeConsoleDemo)
    app.component('PraeConsoleExact', PraeConsoleExact)
    app.component('PraeConsoleExact', PraeConsoleExact)
  }
}
