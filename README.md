# Taxi Compartido — Perico

Aplicación de viajes compartidos con Angular, API Express/Socket.IO y PostgreSQL. Las reservas y los cobros operan en efectivo.

Este repositorio reúne el proyecto completo en la rama `WebDeploy`:

- `PericoFront/`: frontend Angular y configuración pública de la API.
- `PericoBack/`: API, modelos Sequelize, migraciones y pruebas.
- `compose.yaml`: PostgreSQL local, pgAdmin y base descartable de integración.
- `render.yaml`: servicios de backend y frontend para Render, con PostgreSQL en Supabase.

## Desarrollo local

Requiere Docker Compose y Node de `.nvmrc`.

```bash
nvm use
docker compose up -d --wait postgres pgadmin
cd PericoBack
cp -n .env.local.example .env.local
npm ci
npm run db:migrate:local
npm run dev:local
```

En otra terminal, desde la raíz:

```bash
nvm use
cd PericoFront
npm ci
npm start
```

- Aplicación: http://localhost:4200
- Salud de la API: http://localhost:3000/health
- Documentación API: http://localhost:3000/api/docs
- pgAdmin: http://localhost:5050

Las credenciales de Compose son exclusivamente de desarrollo. No se incluyen credenciales reales ni archivos `.env`. Las migraciones crean el esquema privado `taxi`; no se ejecuta sincronización automática de tablas al iniciar.

Consultar [pruebas locales y pgAdmin](PRUEBAS_LOCALES.md), [despliegue en Supabase y Render](DEPLOY_SUPABASE_RENDER.md) y [revisión de salud](SALUD_PROYECTO.md).

## Pruebas

```bash
npm --prefix PericoBack test
npm --prefix PericoFront test -- --watch=false
docker compose --profile test up -d --wait postgres-test
npm --prefix PericoBack run test:db:local
```

La prueba PostgreSQL utiliza una base aislada y crea datos de prueba en ella. Para detener el entorno conservando el volumen de desarrollo:

```bash
docker compose --profile test down
```
