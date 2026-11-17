# Mesa de Ayuda con Monitoreo de SLAs en Tiempo Real

Sistema de Help Desk para registrar, gestionar y resolver tickets de soporte técnico, midiendo en todo momento si se cumple el tiempo de atención acordado (SLA). Cada ticket se muestra con un semáforo (verde, amarillo, rojo) que se actualiza en vivo.

Proyecto #7, Nivel Parejas — Programación Orientada a la Web, Universidad Santiago de Cali.

| Componente | Tecnología | Responsable |
| --- | --- | --- |
| Backend | Node.js, Express, PostgreSQL, Socket.io, Swagger | Sergio Guzmán |
| Frontend | Vue 3, Vite, Pinia, Vue Router, Socket.io client | Franco |

## Reglas del SLA

| Prioridad | Tiempo de resolución |
| --- | --- |
| Baja | 1440 min (24 h) |
| Media | 480 min (8 h) |
| Alta | 120 min (2 h) |
| Crítica | 30 min |

- **Verde (`en_tiempo`):** le queda más del 25 % del tiempo.
- **Amarillo (`por_vencer`):** le queda el 25 % o menos.
- **Rojo (`vencido`):** se acabó el tiempo. El monitor lo registra en `historial_escalados` (una sola vez) y avisa a todos los conectados.
- **En Espera** pausa el reloj; **En Progreso** o **Abierto** lo reanudan sin contar la pausa; **Resuelto** o **Cerrado** lo congelan.
- El tiempo se calcula en PostgreSQL en cada consulta: `ahora − creación − tiempo en pausa`.

## Cómo correrlo

Requisitos: Node.js 20 o superior y PostgreSQL.

1. **Base de datos:** crea una base vacía llamada `MesaAyuda_db`. Las tablas se crean solas al arrancar el backend.
2. **Backend:**
   ```
   cd Backend
   npm install
   ```
   Copia `.env.example` como `.env` y pon tu contraseña de PostgreSQL y un `JWT_SECRET`.
3. **Primer administrador** (crear agentes desde la API exige serlo):
   ```
   npm run crear-admin -- "Nombre Apellido" correo@empresa.com Clave123
   ```
4. **Encender la API:** `npm run dev` → `http://localhost:4000` (Swagger en `/api-docs`).
5. **Frontend** (otra terminal):
   ```
   cd Frontend
   npm install
   npm run dev
   ```
   Abre `http://localhost:5173` e inicia sesión con el administrador.

## Datos de demostración

Con PostgreSQL encendido, desde `Backend`:

```
npm run datos-demo -- --limpiar
```

Borra los tickets que haya y carga 7 de ejemplo en todos los estados (verde, amarillo, rojo escalado, en pausa y resuelto), más los agentes `maria@empresa.com` y `juan@empresa.com` (contraseña `Clave123`). Sin `--limpiar`, solo agrega los tickets.

Dos tickets cambian de color en vivo después de cargar los datos: **Caída de la VPN** pasa a amarillo en cerca de 1 minuto y **Servidor de facturación caído** vence en cerca de 3 minutos y se escala automáticamente.

Para dejar el dashboard vacío (borra todos los tickets y su historial, pero no los agentes) usa el botón **Limpiar tablero** como Administrador, o desde la terminal:

```
npm run limpiar-tickets
```

## Pruebas automáticas

Todas usan el corredor que trae Node (`node:test`), sin dependencias extra. Desde `Backend`:

```
npm test                    # 22 pruebas unitarias, no necesitan base de datos
npm run test:integracion    # 10 pruebas de integración contra PostgreSQL
```

- **Unitarias (`test/`):** reglas y semáforo del SLA, validaciones de tickets y agentes, propiedad del recurso, middleware de tokens y roles, y manejador de errores.
- **Integración (`pruebas-integracion/`):** levantan la API real y la usan por HTTP: login con cookie, rotación y reutilización del refresh token, roles, cálculo del SLA con pausas, propiedad del recurso, dos cambios simultáneos al mismo ticket, monitor y escalado, y borrado. Crean una base de datos aparte (`MesaAyuda_pruebas`) y la borran al terminar, así que no tocan tus datos.

## Arquitectura del Backend (Controller → Service → Repository)

```
Backend/src
├── routes/         Rutas de Express + documentación Swagger
├── middlewares/    verificarToken (JWT) y permitirRoles
├── controllers/    Solo HTTP: leen la petición y responden
├── services/       Reglas de negocio (SLA, tickets, agentes, login, monitor)
├── repositories/   Todo el SQL de PostgreSQL
├── sockets/        Servidor Socket.io autenticado con JWT
├── utils/          ErrorApp y manejador central de errores
├── app.js          Express: middlewares y rutas
├── index.js        Enciende la API, Socket.io y el monitor
├── config/         Conexión, migraciones, CORS y Swagger
└── scripts/        crear-admin y datos-demo

Backend/test                  Pruebas unitarias (npm test)
Backend/pruebas-integracion   Pruebas de integración (npm run test:integracion)
```

Los servicios publican lo que pasa en un bus de eventos interno (`services/eventos.js`); el módulo de sockets lo reenvía a los navegadores. Así la lógica de negocio no depende de Socket.io.

## Seguridad (login con doble token)

- **Access token:** JWT de 15 minutos. El Frontend lo guarda solo en memoria y lo envía en `Authorization: Bearer <token>`.
- **Refresh token:** dura 7 días y viaja en una cookie `HttpOnly`, `SameSite=Strict`, limitada a `/api/auth`. JavaScript no puede leerla (protección contra XSS). En la base se guarda solo su hash SHA-256.
- **Rotación:** cada refresh token sirve una vez. Si se reutiliza uno viejo, se cierran todas las sesiones del agente (detección de robo).
- **Contraseñas** con bcrypt; mismo mensaje de error para correo o clave incorrectos.
- **Roles (RBAC):** solo un Administrador puede crear agentes y borrar tickets (403 para los demás). El Frontend oculta esos botones, pero quien protege es el Backend.
- **Propiedad del recurso:** un Agente solo puede pausar, reanudar o resolver los tickets asignados a él o sin asignar; el Administrador, cualquiera.
- **Concurrencia:** los cambios de estado y la renovación de sesión son transacciones que bloquean la fila (`SELECT ... FOR UPDATE`), así dos peticiones simultáneas no se pisan.
- Al recargar la página, el Frontend recupera la sesión con la cookie, sin pedir la contraseña.

## API

| Método | Ruta | Acceso |
| --- | --- | --- |
| POST | `/api/auth/login` | Público |
| POST | `/api/auth/refresh` | Público (usa la cookie) |
| POST | `/api/auth/logout` | Público (usa la cookie) |
| GET | `/api/auth/perfil` | Con token |
| GET | `/api/tickets` | Con token |
| POST | `/api/tickets` | Con token |
| GET | `/api/tickets/:id` | Con token |
| PUT | `/api/tickets/:id` | Con token |
| DELETE | `/api/tickets/:id` | Solo Administrador |
| DELETE | `/api/tickets` | Solo Administrador (borra todos) |
| GET | `/api/tickets/:id/historial` | Con token |
| GET | `/api/catalogos` | Con token |
| GET | `/api/agentes` | Con token |
| GET | `/api/agentes/:id` | Con token |
| POST | `/api/agentes` | Solo Administrador |

## Tiempo real (Socket.io)

El cliente se conecta al mismo puerto de la API con `auth: { token: <access_token> }`. Sin token válido, la conexión se rechaza.

| Evento | Cuándo |
| --- | --- |
| `ticket:creado` | Alguien crea un ticket |
| `ticket:actualizado` | Alguien pausa, reanuda o resuelve un ticket |
| `sla:cambio` | El monitor detecta un cambio de color (cada 30 s) |
| `ticket:escalado` | Un ticket venció y quedó en el historial de escalados |
| `ticket:eliminado` | Un administrador borró un ticket |
| `tickets:limpiados` | Un administrador limpió el tablero |
