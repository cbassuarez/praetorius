import DefaultTheme from 'vitepress/theme'
import './custom.css'

// Global components available in markdown
import PraePlayground from 'website/docs/components/PraePlayground.vue'
import GitHubMeta from 'website/docs/components/GitHubMeta.vue'
import NpmBadge from 'website/docs/components/NpmBadge.vue'
import GitHubChangelog from 'website/docs/components/GitHubChangelog.vue'
import CLIBlock from 'website/docs/components/CLIBlock.vue'
import SchemaViewer from 'website/docs/components/SchemaViewer.vue'
import ErrorGlossary from 'website/docs/components/ErrorGlossary.vue'
import SinceBadge from 'website/docs/components/SinceBadge.vue'

export default {
  ...DefaultTheme,
  enhanceApp({ app }) {
    app.component('PraePlayground', PraePlayground)
    app.component('GitHubMeta', GitHubMeta)
    app.component('NpmBadge', NpmBadge)
    app.component('GitHubChangelog', GitHubChangelog)
    app.component('CLIBlock', CLIBlock)
    app.component('SchemaViewer', SchemaViewer)
    app.component('ErrorGlossary', ErrorGlossary)
    app.component('SinceBadge', SinceBadge)
  }
}
