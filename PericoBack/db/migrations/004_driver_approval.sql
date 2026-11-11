CREATE TABLE taxi.habilitaciones_chofer (
  "idChofer" integer PRIMARY KEY REFERENCES taxi.choferes ON DELETE CASCADE ON UPDATE CASCADE,
  estado varchar(20) NOT NULL DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE', 'APROBADO', 'RECHAZADO')),
  "idAdmin" integer REFERENCES taxi.admins ON DELETE RESTRICT ON UPDATE CASCADE,
  "fechaDecision" timestamptz,
  motivo text,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CHECK ((estado = 'PENDIENTE' AND "idAdmin" IS NULL AND "fechaDecision" IS NULL) OR
         (estado IN ('APROBADO', 'RECHAZADO') AND "idAdmin" IS NOT NULL AND "fechaDecision" IS NOT NULL))
);
CREATE INDEX habilitaciones_pendientes ON taxi.habilitaciones_chofer (estado);
CREATE INDEX habilitaciones_administrador ON taxi.habilitaciones_chofer ("idAdmin");
-- No asignar aprobaciones ficticias a los choferes anteriores.
INSERT INTO taxi.habilitaciones_chofer ("idChofer") SELECT "idChofer" FROM taxi.choferes;
UPDATE taxi.usuarios u SET activo = false, "updatedAt" = now() FROM taxi.choferes c WHERE u."idUsuario" = c."idUsuario";
UPDATE taxi.choferes SET "estadoChofer" = 'INACTIVO', "updatedAt" = now();
ALTER TABLE taxi.auditorias ADD COLUMN "idUsuarioResponsable" integer REFERENCES taxi.usuarios ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX auditorias_usuario_fecha ON taxi.auditorias ("idUsuarioResponsable", "createdAt" DESC);
REVOKE ALL ON taxi.habilitaciones_chofer FROM PUBLIC;
DO $$
DECLARE rol text;
BEGIN
 FOREACH rol IN ARRAY ARRAY['anon', 'authenticated'] LOOP
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = rol) THEN
   EXECUTE format('REVOKE ALL ON taxi.habilitaciones_chofer FROM %I', rol);
  END IF;
 END LOOP;
END $$;
