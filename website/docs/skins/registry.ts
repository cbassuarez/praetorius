export type Skin = 'typefolio' | 'console' | 'vite-breeze'

export const SKINS: Record<Skin, { rootClass: string; tokens?: Record<string, string> }> = {
  typefolio: {
    rootClass: 'prae-skin-typefolio'
  },
  console: {
    rootClass: 'prae-skin-console'
  },
  'vite-breeze': {
    rootClass: 'prae-skin-vitebreeze'
  }
}
