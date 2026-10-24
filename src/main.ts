import { createPinia } from 'pinia'
import 'primeicons/primeicons.css'
import PrimeVue from 'primevue/config'
import ConfirmationService from 'primevue/confirmationservice'
import { createApp } from 'vue'
import App from './App.vue'
import { AppPreset } from './theme'
import './styles/main.css'

createApp(App)
  .use(createPinia())
  .use(PrimeVue, {
    theme: {
      preset: AppPreset,
      options: {
        darkModeSelector: false,
        // 与 styles/main.css 里声明的层顺序一致：theme, base, primevue, components, utilities
        cssLayer: { name: 'primevue', order: 'theme, base, primevue' },
      },
    },
  })
  .use(ConfirmationService)
  .mount('#app')
