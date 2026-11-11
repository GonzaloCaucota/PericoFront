# Revisión del proyecto — 10 de noviembre de 2026

Estado: mejorado, con compilación y pruebas locales aprobadas. La validación local no certifica el funcionamiento completo en producción.

## Correcciones

- Se validan propietario y permisos de perfiles, cobros y cambios de reservas. Se impide reservar con la identidad de otra persona.
- Los JWT requieren Bearer y una cuenta activa con el rol vigente.
- Las reservas exigen asientos enteros positivos, calculan el importe con la tarifa del viaje y no aceptan estados de pago enviados por el cliente.
- Se impide reactivar reservas canceladas mediante cambios de estado.
- Reservas y cobros operan exclusivamente en efectivo; se retiraron los pagos online, QR, webhook y dependencias asociadas.
- Los eventos Socket.IO requieren JWT y se envían a los participantes y administradores. Las consultas de viajes filtran reservas ajenas.
- Se excluyen hashes de contraseñas de respuestas y nuevos registros de auditoría; los registros históricos no se modificaron. La auditoría usa la transacción de la operación.
- Login con Google crea usuario y perfil de pasajero juntos, comprueba habilitación y devuelve los IDs necesarios para el frontend.
- Perfil sin sesión ya no falla; se protege su ruta. Se tolera almacenamiento de sesión corrupto y se corrige la redirección por rol.
- El interceptor evita enviar el JWT a proveedores externos.
- Se repararon pruebas desactualizadas y sus dependencias de inyección.
- Pantallas con carga bajo demanda reducen la carga inicial de 2,27 MB a 1,10 MB, conservando los presupuestos originales.
- La compilación no necesita descargar Google Fonts. El navegador puede seguir solicitándolas.
- Se agregó .nvmrc y exclusión de dependencias, builds y archivos de secretos.

## Verificación

- Frontend: 20 pruebas aprobadas en 16 archivos.
- Backend: 12 pruebas de regresión aprobadas con modelos simulados, sin escribir en una base real.
- Compilación de producción aprobada.
- Sintaxis JavaScript del backend comprobada.
- npm audit no pudo consultar registry.npmjs.org por EAI_AGAIN. Un resultado offline vacío no acredita ausencia de vulnerabilidades.

## Configuración y límites

Usar Node 22.23.1 (`nvm use` desde la raíz). La versión predeterminada del entorno, 22.22.0, no cumple el mínimo de Angular instalado.

Completar las variables de PericoBack/.env.example en PericoBack/.env. No se requieren credenciales de proveedores de pagos.

Se validaron las migraciones y la API con PostgreSQL 17 local, incluyendo reservas concurrentes. No se conecto a Supabase ni se desplego en Render; falta verificar TLS y dominios reales. Ver DEPLOY_SUPABASE_RENDER.md.

Permanecen advertencias de tamaño de pasajero.scss (4,63 kB frente a 4 kB) y dependencias CommonJS transitivas de exportación PDF. No bloquean la compilación.

La conexion remota ahora verifica TLS, usa un pool limitado y exige DATABASE_URL en produccion. El frontend genera sus URLs HTTP y Socket.IO desde API_URL; ver DEPLOY_SUPABASE_RENDER.md.

La raíz original agrupaba dos repositorios independientes. La rama WebDeploy del repositorio destino reúne frontend, backend, Compose y documentación, excluyendo dependencias instaladas, archivos generados y secretos locales.

## Comandos

```bash
nvm use
cd PericoFront
npm run build
npm test -- --watch=false
cd ../PericoBack
node test/security.test.js
npm test
```


Se aplicó localmente la migración 003 para normalizar ciudades, paradas y recorridos, con dos corredores e ida/vuelta. Detalles y límites en NORMALIZACION.md.

La migración 004 agrega aprobaciones obligatorias de choferes y la relación de auditoría con el administrador autenticado. Se completaron altas y bloqueos del panel; ver ADMINISTRACION.md.
