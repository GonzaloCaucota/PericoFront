# Altas y bloqueos desde la aplicación

## Flujo de choferes

1. El registro público crea una **solicitud pendiente**, con cuenta inactiva y estado operativo INACTIVO. Los estados enviados por el solicitante no pueden aprobar el alta.
2. El administrador entra en **Gestionar Choferes**, revisa los datos y pulsa **Aprobar alta**.
3. La decisión registra el perfil de administrador que aprobó y la fecha. Solo entonces el chofer puede iniciar sesión, registrar vehículos y publicar viajes.
4. Un administrador también puede usar **Dar de alta chofer / pasajero**. El chofer creado por esta vía queda aprobado por ese administrador en la misma transacción.

El registro público no habilita a operar. Una cuenta pendiente o suspendida no puede acceder mediante email, Google, JWT antiguo ni una conexión nueva de Socket.IO. Las peticiones autenticadas consultan el estado vigente, no solo el rol que venía en el token.

La migración **004_driver_approval.sql** agrega `taxi.habilitaciones_chofer`, con un registro por chofer, estado de decisión, `idAdmin`, fecha y motivo. La clave foránea apunta a `taxi.admins`; la identidad y el acceso continúan en `taxi.usuarios`.

Todos los choferes anteriores quedan pendientes de revisión: no se inventa qué administrador los aprobó. La base local ya fue migrada. Se conservó un respaldo privado en `/tmp/taxi-before-aprobaciones.dump` antes del cambio. No se modificaron cuentas en Supabase.

## Panel administrativo

- **Dar de alta chofer / pasajero**: formulario con datos de identidad y contraseña inicial. Para choferes también exige licencia y fecha de habilitación.
- **Gestionar Choferes**: ver pendientes, aprobar alta, bloquear y rehabilitar. Los bloqueos requieren motivo.
- **Gestionar Pasajeros**: dar acceso o bloquear la cuenta, con motivo para el bloqueo.
- **Gestionar vehículos**: deshabilitar o volver a habilitar un auto. Un chofer no puede reactivar un vehículo deshabilitado por administración, ni mediante edición ni mediante cambio de estado.
- **Editar**: cambios de datos personales. El acceso se administra con las acciones específicas del directorio.

Bloquear un chofer desactiva su cuenta, lo marca SUSPENDIDO y cancela sus viajes activos y las reservas aún pendientes o confirmadas en esos viajes. Deshabilitar un vehículo cancela de la misma forma sus viajes activos. Los importes y estados históricos de pagos se conservan; no se genera un reembolso automático de dinero en efectivo.

Bloquear un pasajero desactiva su cuenta y marca su perfil BLOQUEADO. Sus reservas se conservan para revisión administrativa. El bloqueo no borra el historial de la cuenta.

Cuando se bloquea una cuenta se desconectan sus sockets y las siguientes peticiones HTTP se rechazan, incluso si el JWT fue emitido antes del bloqueo. Rehabilitar permite volver a acceder mientras la cuenta y su perfil estén habilitados.

## Endpoints

Todos requieren JWT de una cuenta ADMIN activa y con perfil administrativo activo.

| Método y ruta | Acción |
| --- | --- |
| POST /api/admins/choferes | Alta directa y aprobación de chofer |
| POST /api/admins/pasajeros | Alta de pasajero |
| PATCH /api/admins/choferes/:idChofer/aprobar | Aprobar o rehabilitar |
| PATCH /api/admins/choferes/:idChofer/bloquear | Bloquear chofer y cancelar sus salidas activas |
| PATCH /api/admins/pasajeros/:idPasajero/activar | Habilitar pasajero |
| PATCH /api/admins/pasajeros/:idPasajero/bloquear | Bloquear pasajero |
| PATCH /api/admins/autos/:idAuto/habilitacion | Estado DISPONIBLE o INACTIVO del vehículo |

Los bloqueos reciben `{ "motivo": "Explicacion de la decision" }` (mínimo cinco caracteres). El vehículo recibe también `estado`. Los IDs del administrador y del usuario responsable se obtienen del token validado y de su perfil en la base; no se aceptan desde el formulario.

`POST /api/choferes` permanece público exclusivamente para solicitar el alta. No permite enviar `activo`, `estadoChofer` o una aprobación que habilite al solicitante.

## Auditoría y seguridad

Las acciones usan transacciones. `auditorias.idUsuarioResponsable` relaciona el evento con el usuario administrador autenticado y los eventos de moderación conservan acción y motivo. Los hooks de los modelos también toman el actor de la petición. Los hashes de contraseña no se guardan en el log.

Los viajes nuevos requieren un chofer aprobado y un vehículo disponible. La búsqueda no ofrece viajes de choferes pendientes o suspendidos y el backend vuelve a comprobar la habilitación al reservar.

La contraseña del formulario se envía una vez al backend. El hook del modelo Usuario aplica bcrypt; no prehashearla en el navegador. El primer administrador sigue creándose con `npm run db:create-admin:local` o el equivalente remoto mediante un entorno seguro; no existe un alta pública de administradores.

## Pruebas ejecutadas

En una base PostgreSQL descartable se comprobó:

- Solicitud pública pendiente aunque el cliente envíe estados privilegiados.
- Rechazo del login de un chofer pendiente.
- Un pasajero no puede aprobar choferes.
- Alta directa y aprobación con el ID del administrador real.
- Publicación de viajes tras aprobar al chofer.
- Bloqueos de chofer y pasajero y rechazo de JWT emitidos antes del bloqueo.
- Cancelación de salidas por bloqueo del chofer o del vehículo.
- El chofer no puede reactivar su vehículo bloqueado.
- Auditoría explícita y por hooks con el administrador responsable.

Las pruebas del frontend verifican el formulario de alta y las acciones para solicitudes pendientes, además de exigir motivo antes de bloquear. No se usaron cuentas reales para las pruebas de bloqueo.
