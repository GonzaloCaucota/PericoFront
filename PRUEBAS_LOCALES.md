# Probar la aplicación y PostgreSQL localmente

Desde `/home/gonzalo/WebDevelops/TaxiCompartido`, con Docker/Compose y Node de `.nvmrc` disponibles.

## 1. PostgreSQL y backend

```bash
cd /home/gonzalo/WebDevelops/TaxiCompartido
nvm use
docker compose up -d --wait postgres
cd PericoBack
# Solo la primera vez. -n conserva un archivo local ya existente.
cp -n .env.local.example .env.local
npm ci
npm run db:migrate:local
npm run dev:local
```

Ya se creó `.env.local` durante la preparación. Los comandos `*:local` cargan ese archivo sin reemplazar `.env`. Evitar tener exportadas variables de conexión de otra base en la terminal: Node da prioridad a las variables del shell sobre el archivo.

El Compose usa PostgreSQL 17, un volumen persistente y un healthcheck. Las migraciones se aplican con npm, no desde scripts de inicialización del contenedor: así también funcionan cuando el volumen ya existe.

Conexión para DBeaver, pgAdmin o psql:

| Campo | Valor local |
| --- | --- |
| Host | `127.0.0.1` |
| Puerto | `5433` |
| Base | `perico_db` |
| Usuario | `taxi_local` |
| Contraseña de desarrollo | `taxi_local_password` |
| SSL | Desactivado |
| Esquema de la aplicación | `taxi` |

El puerto se publica únicamente en la interfaz local. Las credenciales son exclusivas para desarrollo; no utilizarlas en Supabase o Render. Si 5433 está ocupado, definir POSTGRES_LOCAL_PORT al ejecutar Compose y cambiar DB_PORT en `.env.local` al mismo valor.

## 2. Frontend, en otra terminal

```bash
cd /home/gonzalo/WebDevelops/TaxiCompartido
nvm use
cd PericoFront
npm ci
npm start
```

Abrir [http://localhost:4200](http://localhost:4200). La API está en [http://localhost:3000](http://localhost:3000), su documentación en [http://localhost:3000/api/docs](http://localhost:3000/api/docs).

No hace falta Google ni credenciales de proveedores para probar el registro y login con email/contraseña. El pasajero puede registrarse desde la aplicación. El registro público de chofer crea una solicitud pendiente; un administrador debe aprobarla en Gestionar Choferes o crearla directamente desde Dar de alta chofer / pasajero. Las reservas y cobros son en efectivo.

Si API_URL o GOOGLE_CLIENT_ID están exportadas en la terminal del frontend, quitarlas con `unset API_URL GOOGLE_CLIENT_ID` para usar los valores locales predeterminados.

## Cliente pgAdmin

Desde la raíz del proyecto:

```bash
docker compose up -d --wait pgadmin
```

Abrir [http://localhost:5050](http://localhost:5050) e iniciar sesión con:

- Email: `admin@example.com`
- Contraseña de pgAdmin: `pgadmin_local_password`

El servidor **Desarrollo → Taxi Compartido - Local** queda precargado. Al conectarlo, ingresar la contraseña de PostgreSQL `taxi_local_password`; se puede marcar guardar contraseña para este entorno local.

Las tablas están en **Databases → perico_db → Schemas → taxi → Tables**. Abrir Query Tool sobre perico_db para ejecutar SQL.

Entre contenedores pgAdmin usa `postgres:5432`; el puerto `127.0.0.1:5433` es para clientes ejecutados en tu computadora. La configuración de pgAdmin persiste en el volumen `pgadmin_data`. Las credenciales de acceso inicial se aplican al crear ese volumen por primera vez.

Para otro puerto web, definir PGADMIN_LOCAL_PORT al iniciar Compose. Este cliente usa credenciales de desarrollo y se publica únicamente en localhost.

## 3. Comprobar la salud y las tablas

Con el backend activo:

```bash
curl http://localhost:3000/health
```

Debe devolver `{"status":"ok"}`.

Desde la raíz del proyecto:

```bash
docker compose ps
docker compose exec postgres psql -U taxi_local -d perico_db -c '\dt taxi.*'
docker compose exec postgres psql -U taxi_local -d perico_db -c 'SELECT version, applied_at FROM taxi.schema_migrations ORDER BY version;'
```

Aparecen las trece tablas de la aplicación más `schema_migrations`.

Para una consola SQL interactiva:

```bash
docker compose exec postgres psql -U taxi_local -d perico_db
```

Dentro de psql, `SET search_path TO taxi;` permite consultar sin anteponer `taxi.`. Los campos camelCase requieren comillas: `SELECT "idUsuario", email, rol FROM usuarios;`. Salir con `\q`.

## 4. Prueba automática de PostgreSQL

Usa un segundo contenedor, puerto `55439`, base `taxi_integration`, con datos en memoria temporal. No escribe en `perico_db`.

Desde la raíz:

```bash
docker compose --profile test up -d --wait postgres-test
cd PericoBack
npm run test:db:local
```

Comprueba migraciones repetibles, tablas y modelos, FK, CHECK, turnos, auditoría, login, health y reservas simultáneas sin sobreventa. El script crea datos de prueba. Para desecharlos y quitar únicamente el contenedor de pruebas, desde la raíz:

```bash
docker compose --profile test rm -s -f postgres-test
```

Si 55439 está ocupado, cambiar POSTGRES_TEST_PORT al ejecutar Compose y ajustar DB_INTEGRATION_URL en `.env.local` con ese puerto.

## 5. Otras pruebas

```bash
cd /home/gonzalo/WebDevelops/TaxiCompartido/PericoBack
npm test
cd ../PericoFront
npm test -- --watch=false
npm run build
```

## 6. Primer administrador, opcional

Completar temporalmente estas variables en `PericoBack/.env.local` con tus datos:

```dotenv
ADMIN_EMAIL=admin@example.test
ADMIN_PASSWORD=elige-una-clave-de-al-menos-12-caracteres
ADMIN_NOMBRE=Admin
ADMIN_APELLIDO=Local
ADMIN_TELEFONO=3880000000
```

Desde `PericoBack`:

```bash
npm run db:create-admin:local
```

Iniciar sesión con ese email y contraseña. Retirar ADMIN_* del archivo al terminar. No se crea un administrador predeterminado y el comando no sobrescribe usuarios existentes.

## 7. Detener el entorno

Detener backend y frontend con Ctrl+C. Desde la raíz:

```bash
docker compose --profile test down
```

La base de desarrollo se conserva en el volumen `postgres_data`. No añadir `-v` salvo que se quiera borrar definitivamente todos los datos locales del Compose.

## Verificación realizada

Se validó `docker compose config`, se iniciaron ambos contenedores, se aplicaron las migraciones sobre `perico_db` y pasó `npm run test:db:local` sobre la base aislada. Tras la validación se quitó el contenedor descartable y se dejó PostgreSQL de desarrollo iniciado.

Referencia: [imagen oficial de PostgreSQL y persistencia con Compose](https://docs.docker.com/guides/postgresql/immediate-setup-and-data-persistence/).

pgAdmin se configura usando el [contenedor oficial](https://www.pgadmin.org/docs/pgadmin4/9.19/container_deployment.html) y la definición precargada de `docker/pgadmin/servers.json`.

Los recorridos San Salvador–Perico y San Salvador–El Carmen se cargan mediante la migración 003, con ida y vuelta. Ver [NORMALIZACION.md](NORMALIZACION.md).
