# Acceso con Google y consulta como invitado

## Configurar Google Cloud

1. Abre https://console.cloud.google.com/auth/overview y selecciona o crea un proyecto.
2. En Google Auth Platform configura Branding (nombre, correo de soporte y contacto), Audience (externa si corresponde) y los datos que solicite la consola. Si queda en pruebas, agrega los correos de prueba en Audience.
3. En Clients crea un cliente OAuth de tipo **Web application**. Agrega `http://localhost:4200` en Authorized JavaScript origins. Si usas `http://127.0.0.1:4200`, agrega ese origen por separado.
4. Copia el Client ID terminado en `.apps.googleusercontent.com`. Este flujo usa el callback JavaScript de Google Identity Services: no requiere un client secret en el frontend ni una URI de redireccion del backend.
5. Agrega `GOOGLE_CLIENT_ID=tu-id.apps.googleusercontent.com` a `PericoBack/.env.local` y reinicia el backend.
6. Inicia el frontend con `API_URL=http://localhost:3001 GOOGLE_CLIENT_ID=tu-id.apps.googleusercontent.com npm start -- --host 127.0.0.1`. Usa Node de `.nvmrc`. El prestart genera `public/app-config.js`.
7. Prueba en `http://localhost:4200/login`. Una cuenta nueva crea un perfil PASAJERO; una existente conserva su rol y debe estar habilitada.

En Render configura el mismo GOOGLE_CLIENT_ID en ambos servicios, agrega la URL HTTPS del frontend en los origenes autorizados y recompila el frontend. Nunca publiques un client secret ni tokens de Google.

El backend verifica firma, vencimiento y audiencia con google-auth-library y exige sub y email verificado. Responde 503 sin Client ID, 400 sin credencial, 401 ante token invalido y 403 ante cuenta bloqueada o chofer pendiente. Sin Client ID no aparece un boton de Google vacio en el frontend.

Las pruebas de integracion simulan el verificador externo para validar altas, reutilizacion del perfil y bloqueo; el inicio real y la configuracion de Google Cloud deben comprobarse con el Client ID y una cuenta autorizada.

## Modo invitado

La portada `/Home` y `/viajes` muestran viajes sin sesion. Permiten filtrar los cuatro sentidos de los recorridos y actualizar los resultados. No se crean usuarios invitados ni se usa un pasajero ficticio.

`GET /api/viajes/publicos` acepta un `idRecorrido` opcional. Devuelve hasta 100 viajes abiertos o en curso desde la fecha local de Jujuy, con asientos, recorrido activo, chofer aprobado y habilitado y vehiculo disponible o en viaje. Solo expone recorrido, paradas, fecha, hora, tarifa, asientos, marca/modelo y estado. Excluye usuarios, contactos, reservas y posiciones.

Las reservas de pasajeros con cuenta y los paneles privados siguen requiriendo autenticacion. Los invitados pueden reservar con nombre y telefono mediante `POST /api/reservas/invitado`. La disponibilidad puede cambiar; se valida nuevamente al reservar. Si no hay viajes reales, se muestra el estado vacio sin crear viajes de ejemplo.
