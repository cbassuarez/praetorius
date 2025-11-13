import DefaultTheme from 'vitepress/theme'
import './custom.css'

// Global components available in markdown
import GitHubMeta from '@components/GitHubMeta.vue'
import NpmBadge from '@components/NpmBadge.vue'
import GitHubChangelog from '@components/GitHubChangelog.vue'
import CLIBlock from '@components/CLIBlock.vue'
import SchemaViewer from '@components/SchemaViewer.vue'
import ErrorGlossary from '@components/ErrorGlossary.vue'
import SinceBadge from '@components/SinceBadge.vue'

export default {
  ...DefaultTheme,
  enhanceApp({ app }) {
    app.component('GitHubMeta', GitHubMeta)
    app.component('NpmBadge', NpmBadge)
    app.component('GitHubChangelog', GitHubChangelog)
    app.component('CLIBlock', CLIBlock)
    app.component('SchemaViewer', SchemaViewer)
    app.component('ErrorGlossary', ErrorGlossary)
    app.component('SinceBadge', SinceBadge)
  }
}
