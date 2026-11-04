import { createRouter, createWebHistory } from 'vue-router'
import DashboardView from '@/views/DashboardView.vue'
import NuevoTicketView from '@/views/NuevoTicketView.vue'
import LoginView from '@/views/LoginView.vue'

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

export default router