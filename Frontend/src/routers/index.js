import { createRouter, createWebHistory } from 'vue-router'
import DashboardView from '@/views/DashboardView.vue'
import NuevoTicketView from '@/views/NuevoTicketView.vue'
import AgentesView from '@/views/AgentesView.vue'
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
    path: '/agentes',
    name: 'agentes',
    component: AgentesView,
    meta: { soloAdmin: true }
  },
  {
    path: '/login',
    name: 'login',
    component: LoginView,
    meta: { publica: true }
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/'
  }
]

const router = createRouter({
  history: createWebHistory(import.meta.env?.BASE_URL || '/'),
  routes
})

// Protege las vistas:
//  - Al abrir la página, intenta recuperar la sesión con la cookie del refresh token.
//  - Sin sesión solo se puede entrar a /login.
//  - Con sesión, /login devuelve al dashboard.
//  - Las vistas soloAdmin exigen rol Administrador.
router.beforeEach(async (to) => {
  const auth = useAuthStore()
  await auth.restaurarSesion()

  if (!auth.estaAutenticado && !to.meta.publica) {
    return { name: 'login' }
  }
  if (auth.estaAutenticado && to.name === 'login') {
    return { name: 'dashboard' }
  }
  if (to.meta.soloAdmin && !auth.esAdmin) {
    return { name: 'dashboard' }
  }
})

export default router
