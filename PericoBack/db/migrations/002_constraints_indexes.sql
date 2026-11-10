-- Restricciones en PostgreSQL, ademas de las validaciones Sequelize.
ALTER TABLE taxi.autos ADD CONSTRAINT autos_capacidad_positiva CHECK ("capacidadAsientos" > 0);
ALTER TABLE taxi.viajes
  ADD CONSTRAINT viajes_asientos_no_negativos CHECK ("asientosDisponibles" >= 0),
  ADD CONSTRAINT viajes_tarifa_positiva CHECK ("tarifaPorAsiento" > 0);
ALTER TABLE taxi.reservas
  ADD CONSTRAINT reservas_asientos_positivos CHECK ("cantidadAsientos" > 0),
  ADD CONSTRAINT reservas_importe_positivo CHECK ("importeTotal" > 0);
ALTER TABLE taxi.pasajeros
  ADD CONSTRAINT pasajeros_calificacion_rango CHECK (calificacion BETWEEN 0 AND 5),
  ADD CONSTRAINT pasajeros_reservas_no_negativas CHECK ("cantidadReservas" >= 0),
  ADD CONSTRAINT pasajeros_coordenadas_validas CHECK (latitud BETWEEN -90 AND 90 AND longitud BETWEEN -180 AND 180),
  ADD CONSTRAINT pasajeros_precision_valida CHECK (precision >= 0);
ALTER TABLE taxi.choferes
  ADD CONSTRAINT choferes_calificacion_rango CHECK (calificacion BETWEEN 0 AND 5),
  ADD CONSTRAINT choferes_coordenadas_validas CHECK (latitud BETWEEN -90 AND 90 AND longitud BETWEEN -180 AND 180),
  ADD CONSTRAINT choferes_precision_valida CHECK (precision >= 0);

CREATE UNIQUE INDEX usuarios_email_normalizado ON taxi.usuarios (lower(email));
-- Un chofer puede volver a usar el mismo auto en diferentes turnos.
CREATE UNIQUE INDEX turnos_identidad ON taxi.turnos_chofer ("idChofer", "idAuto", fecha, "horaInicio");
CREATE INDEX turnos_chofer_fecha ON taxi.turnos_chofer ("idChofer", fecha);
CREATE INDEX turnos_auto_fecha ON taxi.turnos_chofer ("idAuto", fecha);
CREATE INDEX viajes_disponibilidad ON taxi.viajes ("estadoViaje", "fechaSalida", "horaSalida");
CREATE INDEX viajes_chofer_fecha ON taxi.viajes ("idChofer", "fechaSalida");
CREATE INDEX viajes_auto_estado ON taxi.viajes ("idAuto", "estadoViaje");
CREATE INDEX reservas_pasajero_fecha ON taxi.reservas ("idPasajero", "createdAt" DESC);
CREATE INDEX reservas_viaje_estado ON taxi.reservas ("idViaje", "estadoReserva");
CREATE INDEX auditorias_registro_fecha ON taxi.auditorias ("tablaAfectada", "registroId", "createdAt" DESC);

-- Solo Express accede a este esquema mediante la conexion PostgreSQL del servidor.
-- No incluir taxi en "Exposed schemas" de Supabase.
REVOKE ALL ON SCHEMA taxi FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA taxi FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA taxi FROM PUBLIC;
DO $$
DECLARE rol text;
BEGIN
  FOREACH rol IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = rol) THEN
      EXECUTE format('REVOKE ALL ON SCHEMA taxi FROM %I', rol);
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA taxi FROM %I', rol);
      EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA taxi FROM %I', rol);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA taxi REVOKE ALL ON TABLES FROM %I', rol);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA taxi REVOKE ALL ON SEQUENCES FROM %I', rol);
    END IF;
  END LOOP;
END $$;
