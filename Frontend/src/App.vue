<template>
  <nav class="barra">
    <router-link to="/">Dashboard</router-link>
    <router-link to="/tickets/nuevo">Nuevo ticket</router-link>
  </nav>

  <router-view />
</template>

<style scoped>
.barra {
  display: flex;
  gap: 1.5rem;
  padding: 1rem 2rem;
  background: #1e293b;
  font-family: system-ui, -apple-system, sans-serif;
}

.barra a {
  color: #e2e8f0;
  text-decoration: none;
  font-weight: 600;
  padding-bottom: 0.25rem;
  border-bottom: 2px solid transparent;
}

.barra a:hover {
  color: #fff;
}

.barra a.router-link-exact-active {
  color: #fff;
  border-bottom-color: #38bdf8;
}
</style>