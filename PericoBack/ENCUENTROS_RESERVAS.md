# Encuentro y ausencia por reserva

- Cada reserva tiene su propio horario de encuentro en la fecha del viaje (horario de Jujuy).
- El pasajero titular propone el horario y el chofer del viaje lo acepta. Los invitados proponen el horario consultando su comprobante. El pasajero no puede aceptar su propia propuesta y el chofer no puede proponer en su nombre.
- Cambiar la propuesta invalida la aceptación anterior. No se permiten propuestas en el pasado ni confirmaciones de versiones anteriores.
- Pasados 10 minutos desde el horario aceptado, el chofer del viaje puede registrar «No se presentó», previa confirmación en pantalla. La hora se comprueba en el servidor.
- La reserva queda como `NO_PRESENTADO`; se guardan fecha y usuario responsable y se liberan todos sus asientos en la misma transacción. Repetir la acción no vuelve a liberarlos.
- El pasajero con cuenta recibe el cambio de estado; el invitado lo ve al consultar su comprobante. Las reservas existentes sin horario aceptado conservan sus asientos.
- Una reserva con pago registrado requiere resolución administrativa. Esta función no gestiona reembolsos.
- La cancelación genérica del chofer no permite saltarse la espera. Los pasajeros conservan sus acciones de cancelación existentes.
- `008_reservation_meeting.sql` agrega los campos necesarios, sin alterar reservas existentes. El inicio de Render configurado en `render.yaml` ejecuta `npm run db:migrate` antes de levantar la nueva versión.

Publicar frontend y backend de `WebDeploy`. Esta función requiere que el backend termine el despliegue y la migración antes de verificarla en la web publicada.

`009_meeting_driver_acceptance.sql` identifica al chofer que acepta. Los horarios activos del flujo anterior requieren una nueva propuesta del pasajero y aceptación del chofer; no se asume que una propuesta anterior del chofer haya sido puesta por el pasajero. Se conserva el historial de reservas terminadas.
