// import { createMemoryHistory, createRouter } from 'vue-router'
// import ToolBar from '@/components/ToolBar.vue'
// import About from '@/MyAbout.vue'

// const routes = [
//     { path: '/', name: 'home', component: ToolBar },
//     { path: '/about', name: 'about', component: About },
// ]

// export const router = createRouter({
//     history: createMemoryHistory(),
//     routes,
// })

import { createRouter, createWebHistory, createWebHashHistory } from 'vue-router'
import ToolBar from '@/components/ToolBar.vue'
import About from '@/components/views/MyAbout.vue'
import Print from '@/components/views/printLable.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: ToolBar
    },
    {
      path: '/about',
      name: 'about',
      // route level code-splitting
      // this generates a separate chunk (About.[hash].js) for this route
      // which is lazy-loaded when the route is visited.
      component: About
    },
    {
      path: '/print-pdf',
      name: 'print-pdf',
      component: Print
    }
  ]
})

export default router
