ALTER TABLE taxi.reservas
  ADD COLUMN "horarioEncuentro" TIMESTAMPTZ,
  ADD COLUMN "encuentroConfirmadoAt" TIMESTAMPTZ,
  ADD COLUMN "noPresentadoAt" TIMESTAMPTZ,
  ADD COLUMN "noPresentadoPor" INTEGER REFERENCES taxi.usuarios("idUsuario") ON DELETE SET NULL,
  ADD CONSTRAINT reserva_encuentro_confirmado CHECK ("encuentroConfirmadoAt" IS NULL OR "horarioEncuentro" IS NOT NULL),
  ADD CONSTRAINT reserva_ausencia_registrada CHECK ("noPresentadoAt" IS NULL OR "estadoReserva" = 'NO_PRESENTADO');
