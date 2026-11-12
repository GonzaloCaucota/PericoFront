ALTER TABLE taxi.reservas
  ADD COLUMN "encuentroAceptadoPor" INTEGER REFERENCES taxi.usuarios("idUsuario") ON DELETE RESTRICT;
-- Las confirmaciones del flujo anterior eran del pasajero, no una aceptacion del chofer.
-- Pedir una nueva propuesta al pasajero en las reservas activas del flujo anterior.
UPDATE taxi.reservas SET "horarioEncuentro" = NULL, "encuentroConfirmadoAt" = NULL WHERE "horarioEncuentro" IS NOT NULL AND "estadoReserva" IN ('PENDIENTE', 'CONFIRMADA');
ALTER TABLE taxi.reservas ADD CONSTRAINT reserva_aceptacion_chofer CHECK (
  "encuentroAceptadoPor" IS NULL OR "encuentroConfirmadoAt" IS NOT NULL
);
