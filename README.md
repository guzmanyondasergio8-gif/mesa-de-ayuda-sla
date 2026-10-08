Sistema de Mesa de Ayuda con Monitoreo de SLAs en Tiempo Real

Descripción del Proyecto

Este sistema de gestión de incidencias (Help Desk) está diseñado para optimizar y controlar los tiempos de atención técnica mediante el monitoreo de Acuerdos de Nivel de Servicio (SLA) en tiempo real, cálculo de métricas clave de desempeño y escalado automático de tickets.


Características Principales

1. *Cronómetros Persistentes y Horario Laboral:*
   - Medición de tiempos de respuesta y solución.
   - Pausa automática fuera de jornada laboral y días festivos.
   - Resiliencia ante reinicios de servidor.

2. *Monitoreo de SLAs en Tiempo Real:*
   - Visualización de tiempo restante por ticket (semaforización: verde, amarillo, rojo).
   - Actualización mediante eventos en tiempo real.

3. *Escalado Automático:*
   - Reasignación y cambio de prioridad según umbrales de tiempo.
   - Notificaciones automáticas a supervisores.

4. *Cálculo Continuo de MTTR:*
   - Medición automatizada del Tiempo Medio de Resolución (MTTR) por agente y departamento.


Tecnologías Planificadas
- *Backend:* Node.js / Express
- *Base de Datos:* PostgreSQL
- *Real-Time / Cache:* Redis / WebSockets
- *Control de Versiones:* Git & GitHub


Integrantes
- Sergio Guzmán Yonda
- Nicolas Alessandro Muñoz Franco