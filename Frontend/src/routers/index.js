import { createRouter, createWebHistory } from 'vue-router'
import DashboardView from '@/views/DashboardView.vue'
import NuevoTicketView from '@/views/NuevoTicketView.vue'
import LoginView from '@/views/LoginView.vue'
import { useAuthStore } from '@/store/auth'

const routes = [
  {
    path: '/',
    name: 'dashboard',
    component: DashboardView
  },
  {
    path: '/tickets/nuevo',
    name: 'nuevo-ticket',
    component: NuevoTicketView
  },
  {
    path: '/login',
    name: 'login',
    component: LoginView
  }
]

const router = createRouter({
  history: createWebHistory(import.meta.env?.BASE_URL || '/'),
  routes
})

// Protege las vistas: sin sesión solo se puede entrar a /login
router.beforeEach((to) => {
  const auth = useAuthStore()

  if (!auth.estaAutenticado && to.name !== 'login') {
    return { name: 'login' }
  }
  if (auth.estaAutenticado && to.name === 'login') {
    return { name: 'dashboard' }
  }
})

export default router