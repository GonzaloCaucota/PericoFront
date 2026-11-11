# Despliegue: Netlify + Render + Supabase

El repositorio completo es `GonzaloCaucota/PericoFront`, rama **WebDeploy**. Angular se publica como sitio estatico en Netlify; Express y Socket.IO en Render; PostgreSQL en Supabase. Se conservan JWT, bcrypt y Google Identity Services propios: no se necesita Supabase Auth ni exponer claves de Supabase al frontend.

## 1. Crear PostgreSQL en Supabase

- Crear un proyecto independiente para TaxiCompartido y guardar su password de base.
- En **Connect → Session pooler**, copiar la URL PostgreSQL exacta (IPv4, puerto **5432**, usuario `postgres.PROJECT_REF`). Codificar los caracteres especiales de la password en la URL. No usar la URL HTTP del proyecto ni el Transaction pooler en 6543.
- Activar SSL enforcement. Si el certificado requiere una CA adicional, descargarla del panel y definir `DB_SSL_CA` con el PEM completo o `DB_SSL_CA_FILE` con su ruta secreta. Nunca desactivar la verificacion TLS.
- Mantener **taxi** fuera de **Exposed schemas** de la Data API. El frontend accede solo a Express. No otorgar permisos a `anon` ni `authenticated`.

Las siete migraciones crean 14 tablas de dominio, relaciones, restricciones y vistas. Se aplican automaticamente al iniciar el backend y quedan registradas en `taxi.schema_migrations`. No editar SQL ya aplicado ni usar Sequelize sync/force. Las migraciones no copian datos historicos de public ni los datos locales; una base nueva comienza sin usuarios ni viajes. La migracion 004 deja pendientes a los choferes antiguos hasta aprobacion administrativa.

## 2. Reservar el sitio en Netlify

Crear un sitio desde GitHub, seleccionar **WebDeploy** y dejar que Netlify lea `netlify.toml` desde la raiz. No cambiar el directorio de publicacion a la raiz del repositorio.

| Campo | Valor |
| --- | --- |
| Base directory | `PericoFront` |
| Build command | `npm run build` |
| Publish directory (relativo a base) | `dist/proyfrontendgrupo03/browser` |
| Node | `22.23.1` |

Elegir el nombre del sitio y guardar su origen final HTTPS, por ejemplo `https://taxi-compartido.netlify.app`. Antes del primer build exitoso se necesita API_URL del paso siguiente. Las credenciales se configuran en los paneles de hosting, no en Git.

El archivo `PericoFront/public/_redirects` contiene la regla:

```text
/* /index.html 200
```

Angular copia ese archivo al directorio publicado. Es una reescritura con estado 200; permite recargar `/Home`, `/viajes`, `/login`, `/pasajero` y `/admin` sin un 404. Los archivos existentes siguen sirviendose normalmente. `netlify.toml` evita cachear `app-config.js` y permite los popups de Google con Cross-Origin-Opener-Policy.

## 3. Crear el backend en Render

Crear un **Blueprint** desde el repositorio, rama **WebDeploy**. `render.yaml` crea solamente la API en plan Free; no crea otro frontend ni una base Render. Alternativamente crear un Web Service con los mismos valores:

| Campo | Valor |
| --- | --- |
| Root directory | `PericoBack` |
| Build | `npm ci --omit=dev` |
| Start | `npm run db:migrate && npm start` |
| Health check | `/health` |
| Node | `22.23.1` |

Variables de Render:

| Variable | Valor |
| --- | --- |
| NODE_ENV | `production` |
| DATABASE_URL | URL del Session pooler de Supabase, incluyendo password |
| DB_SSL | `true` |
| DB_SSL_CA | PEM completo si la CA es necesaria; vacio si ya es confiable |
| DB_POOL_MAX | `5` |
| JWT_SECRET | Generado por Blueprint; minimo 32 caracteres y estable entre despliegues |
| FRONTEND_URL | Origen HTTPS de Netlify, sin ruta ni barra final |
| GOOGLE_CLIENT_ID | El mismo ID OAuth web del frontend |

PORT lo proporciona Render; el servidor escucha en 0.0.0.0. Las migraciones deben finalizar antes de servir HTTP. Si fallan TLS, credenciales o checksums, el despliegue se detiene. No usar DB_SSL=false ni rejectUnauthorized=false para eludir errores. `/health` devuelve 200 cuando PostgreSQL responde.

Render Free comparte las horas gratuitas del workspace y puede dormir sin trafico. La primera consulta puede demorar al despertar. La aplicacion no instala tareas para mantenerlo despierto. No incluye almacenamiento persistente local.

## 4. Configurar y publicar el frontend

En Netlify definir las variables de build:

```text
API_URL=https://NOMBRE-REAL-API.onrender.com
GOOGLE_CLIENT_ID=TU-ID.apps.googleusercontent.com
```

API_URL es el origen del backend, **sin /api**. Netlify instala las dependencias y ejecuta el build. El prebuild genera `public/app-config.js`, que contiene solo configuracion publica. Si falta API_URL o no usa HTTPS, el build en hosting falla para evitar publicar localhost por accidente. Cambiar estas variables requiere otro build.

En Google Cloud agregar el origen HTTPS real de Netlify a **Authorized JavaScript origins** del cliente OAuth. Mantener localhost si se sigue probando localmente. No hace falta enviar el Client Secret al navegador. No usar previews de Netlify para autenticar contra produccion sin configurar expresamente sus origenes en Google y CORS; el backend acepta un unico FRONTEND_URL.

## 5. Crear el primer administrador

El plan Free de Render no tiene shell interactiva. Desde una terminal local segura, crear un archivo **ignorado** `PericoBack/.env.production` con DATABASE_URL, DB_SSL, DB_SSL_CA si corresponde y ADMIN_EMAIL, ADMIN_PASSWORD (minimo 12 caracteres), ADMIN_NOMBRE, ADMIN_APELLIDO y ADMIN_TELEFONO. No reutilizar el administrador local ni subir este archivo.

```bash
cd PericoBack
node --env-file=.env.production scripts/create-admin.js
```

El script crea usuario y perfil en una transaccion y aplica bcrypt una sola vez. No sobreescribe cuentas existentes. Retirar ADMIN_PASSWORD y los datos temporales despues de crearlo. El admin puede aprobar choferes, bloquear cuentas y vehiculos y gestionar la operacion. Crear viajes reales desde la aplicacion; no se publican fixtures ni credenciales predeterminadas.

## 6. Comprobaciones del despliegue

1. `/health` del backend responde 200 y los logs confirman migraciones aplicadas.
2. Abrir y recargar `/viajes` y `/login` directamente en Netlify.
3. Verificar que app-config.js apunta al backend HTTPS y que Google inicia sesion.
4. Crear/aprobar un chofer, asignar auto y turno, publicar un viaje y comprobar Socket.IO por WSS.
5. Reservar como invitado con nombre y telefono, consultar el comprobante y cancelar; verificar asientos y cobro en efectivo.
6. Compartir ubicacion con permiso del navegador, verla en el mapa privado del chofer y retirarla. HTTPS es necesario para geolocalizacion fuera de localhost.
7. Confirmar que el catalogo publico no expone reservas, contactos ni posiciones y que los pasajeros no acceden al panel admin.

Pruebas locales e instrucciones: [PRUEBAS_LOCALES.md](PRUEBAS_LOCALES.md), [ADMINISTRACION.md](ADMINISTRACION.md), [NORMALIZACION.md](NORMALIZACION.md) y [GOOGLE_LOGIN.md](GOOGLE_LOGIN.md).

Preparar y publicar el codigo no crea los servicios remotos: falta crear los proyectos, configurar sus secretos y verificar los dominios y TLS reales.

## Referencias oficiales

- https://docs.netlify.com/build/configure-builds/file-based-configuration/
- https://docs.netlify.com/manage/routing/redirects/rewrites-proxies/
- https://render.com/docs/blueprint-spec
- https://render.com/docs/free
- https://supabase.com/docs/guides/database/connecting-to-postgres
