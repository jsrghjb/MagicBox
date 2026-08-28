// https://vitepress.dev/guide/custom-theme
import Layout from './Layout.vue'

import './rainbow.css'
import './vars.css'
import './overrides.css'

/** @type {import('vitepress').Theme} */
export default {
  Layout,
  enhanceApp() {},
}
