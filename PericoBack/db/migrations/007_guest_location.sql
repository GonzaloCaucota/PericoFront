ALTER TABLE taxi.invitados
 ADD COLUMN latitud DECIMAL(10,8),
 ADD COLUMN longitud DECIMAL(11,8),
 ADD COLUMN precision DECIMAL(10,2),
 ADD COLUMN "ubicacionActualizadaAt" TIMESTAMPTZ,
 ADD CONSTRAINT invitado_ubicacion_valida CHECK (
   (latitud IS NULL AND longitud IS NULL AND precision IS NULL AND "ubicacionActualizadaAt" IS NULL)
   OR (latitud IS NOT NULL AND longitud IS NOT NULL AND precision IS NOT NULL AND "ubicacionActualizadaAt" IS NOT NULL
       AND latitud BETWEEN -90 AND 90 AND longitud BETWEEN -180 AND 180 AND precision >= 0)
 );
