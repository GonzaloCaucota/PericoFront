# PostgreSQL en Supabase y aplicación en Render

## Arquitectura preparada

Angular → API Express y Socket.IO en Render → PostgreSQL de Supabase mediante Sequelize.

Se conserva la autenticación propia con JWT y bcrypt. No se necesita Supabase Auth ni enviar una service-role key al navegador. Los pagos son exclusivamente en efectivo.

La aplicación utiliza el esquema privado `taxi`, fuera de la Data API de Supabase. No añadir `taxi` a **Exposed schemas** ni conceder acceso a `anon` o `authenticated`. Las migraciones revocan los permisos de esos roles si existen. El acceso de usuarios se controla en Express, que se conecta con el usuario de base del servidor. El rol propietario de las tablas sigue siendo privilegiado: guardar su conexión solo en el backend.

## Tablas y migraciones

| Tabla | Relación principal |
| --- | --- |
| usuarios | Identidad, rol y hash bcrypt |
| pasajeros | Un perfil por usuario |
| choferes | Un perfil por usuario |
| admins | Un perfil por usuario |
| autos | Capacidad y estado |
| turnos_chofer | Chofer y auto por fecha y horario |
| viajes | Chofer y auto obligatorios |
| reservas | Pasajero y viaje, asientos e importe |
| auditorias | Cambios sin hashes de contraseña |

`taxi.schema_migrations` registra las versiones y sus checksums; no es una tabla del dominio.

- `PericoBack/db/migrations/001_initial.sql`: tablas, tipos ENUM, claves y relaciones compatibles con los modelos.
- `PericoBack/db/migrations/002_constraints_indexes.sql`: CHECK, índices y permisos.
- `npm run db:migrate`: aplica las migraciones en una transacción con bloqueo para despliegues concurrentes. Repetir el comando no vuelve a aplicar versiones existentes.
- No editar una migración aplicada: agregar una nueva. El arranque verifica versiones y checksums y nunca ejecuta `sync`, `alter` ni `force`.

Esto inicializa una base nueva. Si ya existen datos en tablas de `public`, permanecen allí y no se copian automáticamente a `taxi`. Antes de cambiar una instancia con datos, realizar backup y preparar una migración de datos específica; no ejecutar DROP ni mover tablas manualmente para eludir un error de migración. Una tabla preexistente en `taxi` sin historial provoca un error en vez de adoptarse silenciosamente.

## 1. Crear el proyecto de Supabase

1. Crear un proyecto y conservar la contraseña de la base en un gestor de secretos.
2. En **Connect**, copiar la cadena **Session pooler**, puerto `5432`. El usuario suele tener el formato `postgres.PROJECT_REF`; copiar el host y usuario exactos del panel.
3. Sustituir la contraseña en la URL usando codificación de URL para caracteres especiales. No usar la URL HTTP del proyecto ni una API key como `DATABASE_URL`.
4. Activar SSL enforcement y descargar el certificado CA desde la configuración SSL de la base cuando sea necesario para verificar su cadena.
5. Mantener el esquema `taxi` fuera de los esquemas expuestos de la Data API.

Para un servidor persistente se puede usar conexión directa si su red soporta IPv6. El Session pooler es la opción preparada para evitar problemas de IPv4. No usar el puerto `6543` de Transaction pooler en esta configuración.

La conexión usa TLS con verificación de certificado activada. Si el proveedor ya tiene una CA reconocida, no es necesario un certificado personalizado. Si se necesita, definir `DB_SSL_CA` con el PEM completo o `DB_SSL_CA_FILE` con la ruta de un archivo secreto; no desactivar la verificación. No añadir `sslmode` ni certificados en la URL: la aplicación administra esas opciones de forma explícita.

## 2. Preparar el repositorio

El `render.yaml` de la raíz define dos servicios: backend Node y frontend estático. Subir ambos proyectos, los lockfiles, las migraciones y el Blueprint al repositorio que se conectará con Render. No subir `.env`, certificados privados, contraseñas ni `node_modules`.

El repositorio destino es https://github.com/GonzaloCaucota/PericoFront, rama `WebDeploy`. Esta rama contiene frontend, backend y configuración desde la raíz; seleccionar esa rama al conectar Render.

## 3. Configurar Render

Crear un Blueprint desde el repositorio y revisar el plan/coste de los servicios antes de crearlos. No se creó ningún servicio remoto durante esta preparación.

### Backend: taxi-compartido-api

- Root directory: `PericoBack`
- Build: `npm ci --omit=dev`
- Start: `npm run db:migrate && npm start`
- Health check: `/health`
- Node: `22.23.1`
- El servidor escucha en `0.0.0.0` y utiliza el `PORT` asignado por Render.

Variables:

| Variable | Valor |
| --- | --- |
| NODE_ENV | `production` |
| DATABASE_URL | Cadena Session pooler de Supabase |
| DB_SSL | `true` |
| DB_SSL_CA | PEM del certificado CA cuando sea necesario; puede dejarse vacío si la cadena ya es confiable |
| DB_POOL_MAX | `5` por instancia; ajustar al límite de conexiones del proyecto |
| JWT_SECRET | Generado por el Blueprint; mantenerlo estable entre despliegues y mínimo 32 caracteres |
| FRONTEND_URL | Origen HTTPS real del frontend, sin ruta; por ejemplo `https://taxi-compartido-web.onrender.com` |
| GOOGLE_CLIENT_ID | ID público de Google OAuth si se habilita ese login; vacío para omitirlo |

Las migraciones están en el comando de inicio para no depender de una función de predeploy asociada a un plan particular. El proceso HTTP solo arranca si la base está accesible y las migraciones están al día. Los cambios futuros deben ser compatibles con la instancia anterior durante el despliegue.

El health check responde `200` si puede consultar PostgreSQL y `503` si no puede. SIGTERM/SIGINT cierran Socket.IO, HTTP y el pool de base.

### Frontend: taxi-compartido-web

- Root directory: `PericoFront`
- Build: `npm ci && npm run build`
- Publish: `dist/proyfrontendgrupo03/browser`
- Rewrite: `/*` a `/index.html` para las rutas de Angular.
- `API_URL`: origen HTTPS real del backend, sin `/api` ni barra final obligatoria.
- `GOOGLE_CLIENT_ID`: el mismo ID usado en backend, o vacío.

`prebuild` genera `public/app-config.js` con configuración pública. HTTP, JWT y Socket.IO utilizan ese origen; no quedan servicios apuntando a localhost de forma fija. Cambiar API_URL requiere reconstruir el frontend. El archivo de configuración se sirve sin caché según el Blueprint.

Las URLs finales pueden variar por disponibilidad de nombres: verificar ambos dominios reales y actualizar FRONTEND_URL/API_URL. El CORS del backend acepta únicamente el origen configurado. Si se usa Google, registrar el dominio HTTPS del frontend como origen autorizado en Google Cloud.

## 4. Crear el primer administrador

No se incluyen cuentas ni contraseñas predeterminadas. Una vez aplicadas las migraciones, ejecutar desde una terminal segura que tenga la conexión de backend:

```bash
cd PericoBack
npm run db:create-admin
```

Definir antes `ADMIN_EMAIL`, `ADMIN_PASSWORD` (mínimo 12 caracteres), `ADMIN_NOMBRE`, `ADMIN_APELLIDO` y `ADMIN_TELEFONO`, además de DATABASE_URL/TLS. Usar un gestor de secretos o variables de entorno, evitando escribir la contraseña en comandos que queden en el historial. El script crea usuario y perfil admin en una transacción y aplica bcrypt. No cambia una cuenta existente y falla ante email duplicado. Retirar las variables ADMIN_* al finalizar. Este script no se ejecuta automáticamente en cada despliegue.

## Desarrollo local

Para iniciar PostgreSQL con Docker Compose y probar las migraciones, seguir [PRUEBAS_LOCALES.md](PRUEBAS_LOCALES.md). Los comandos `*:local` usan `.env.local` y no requieren modificar las credenciales del despliegue.

```bash
nvm use
cd PericoBack
# Copiar .env.example a .env y completar credenciales locales.
# Crear previamente perico_db con el propietario de DB_USER.
npm ci
npm run db:migrate
npm start
```

En otra terminal:

```bash
cd PericoFront
npm ci
npm start
```

Para el frontend local, `API_URL` por defecto es `http://localhost:3000`. `GOOGLE_CLIENT_ID` vacío no carga Google Identity. FRONTEND_URL local por defecto es `http://localhost:4200`.

## Validación ejecutada

Se usó PostgreSQL 17 local en una instancia temporal, sin conectar ni modificar Supabase u otra base existente. La prueba `npm run test:db` exige una base local aislada llamada `taxi_integration`, con su URL en `DB_INTEGRATION_URL`. Crea datos de prueba en ella y no debe apuntarse a una base de uso diario.

Se verificaron migraciones repetibles, las nueve tablas mediante consultas de los modelos, ENUM, claves foráneas, CHECK, varios turnos para un mismo chofer/auto, auditoría sin hashes, login HTTP, `/health` y dos reservas simultáneas sobre el último asiento (una aceptada y otra rechazada).

Falta aplicar las migraciones y probar la conexión TLS en el proyecto real de Supabase, así como verificar los dominios, el CORS y la conexión Socket.IO en Render.

## Fuentes oficiales

- [Conexiones PostgreSQL y poolers de Supabase](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [Verificación SSL con psql](https://supabase.com/docs/guides/database/psql)
- [Esquemas expuestos en la Data API](https://supabase.com/docs/guides/api/using-custom-schemas)
- [Blueprints de Render](https://render.com/docs/blueprint-spec)
- [Health checks de Render](https://render.com/docs/health-checks)
