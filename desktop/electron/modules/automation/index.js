import window from './window.js'

export default {
  name: 'module:automation',
  order: 100,
  apply(mainApp) {
    mainApp.use(window)
  },
}
