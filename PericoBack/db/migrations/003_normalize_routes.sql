-- Ciudades y paradas compartidas por un catalogo de recorridos direccionales.
CREATE TABLE taxi.ciudades (
  "idCiudad" serial PRIMARY KEY,
  nombre varchar(255) NOT NULL CHECK (length(trim(nombre)) > 0),
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ciudades_nombre_unico ON taxi.ciudades (lower(trim(nombre)));
CREATE TABLE taxi.paradas (
  "idParada" serial PRIMARY KEY,
  "idCiudad" integer NOT NULL REFERENCES taxi.ciudades ON UPDATE CASCADE ON DELETE RESTRICT,
  nombre varchar(255) NOT NULL,
  referencia text,
  "ubicacionConfirmada" boolean NOT NULL DEFAULT false,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  UNIQUE ("idCiudad", nombre)
);
CREATE TABLE taxi.recorridos (
  "idRecorrido" serial PRIMARY KEY,
  codigo varchar(100) NOT NULL UNIQUE,
  "idParadaOrigen" integer NOT NULL REFERENCES taxi.paradas ON UPDATE CASCADE ON DELETE RESTRICT,
  "idParadaDestino" integer NOT NULL REFERENCES taxi.paradas ON UPDATE CASCADE ON DELETE RESTRICT,
  activo boolean NOT NULL DEFAULT true,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CHECK ("idParadaOrigen" <> "idParadaDestino"),
  UNIQUE ("idParadaOrigen", "idParadaDestino")
);
CREATE INDEX recorridos_destino ON taxi.recorridos ("idParadaDestino");
INSERT INTO taxi.ciudades (nombre) VALUES ('San Salvador de Jujuy'), ('Perico'), ('El Carmen');
INSERT INTO taxi.paradas ("idCiudad", nombre, referencia, "ubicacionConfirmada")
SELECT "idCiudad", 'Dorrego y Jorge Newbery', 'Zona de la vieja terminal. Salida hacia Perico indicada por el usuario.', true FROM taxi.ciudades WHERE nombre = 'San Salvador de Jujuy'
UNION ALL SELECT "idCiudad", 'Independencia y Lavalle', 'Salida hacia El Carmen indicada por el usuario.', true FROM taxi.ciudades WHERE nombre = 'San Salvador de Jujuy'
UNION ALL SELECT "idCiudad", 'Centro / acceso a la feria', 'Referencia aproximada; falta precisar la esquina de ascenso y descenso.', false FROM taxi.ciudades WHERE nombre = 'Perico'
UNION ALL SELECT "idCiudad", 'Centro de El Carmen', 'Referencia aproximada: zona de Cnel. Arenas. Falta precisar la esquina.', false FROM taxi.ciudades WHERE nombre = 'El Carmen';
INSERT INTO taxi.recorridos (codigo, "idParadaOrigen", "idParadaDestino")
SELECT datos.codigo, origen."idParada", destino."idParada"
FROM (VALUES
 ('SSJ_PERICO', 'Dorrego y Jorge Newbery', 'Centro / acceso a la feria'),
 ('PERICO_SSJ', 'Centro / acceso a la feria', 'Dorrego y Jorge Newbery'),
 ('SSJ_EL_CARMEN', 'Independencia y Lavalle', 'Centro de El Carmen'),
 ('EL_CARMEN_SSJ', 'Centro de El Carmen', 'Independencia y Lavalle')
) datos(codigo, origen, destino)
JOIN taxi.paradas origen ON origen.nombre = datos.origen
JOIN taxi.paradas destino ON destino.nombre = datos.destino;

-- Canonicalizar nombres conocidos sin alterar las migraciones anteriores.
CREATE FUNCTION pg_temp.ciudad_canonica(text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
 SELECT CASE lower(trim($1))
  WHEN 'jujuy' THEN 'San Salvador de Jujuy'
  WHEN 'san salvador de jujuy' THEN 'San Salvador de Jujuy'
  WHEN 'perico' THEN 'Perico'
  WHEN 'el carmen' THEN 'El Carmen'
  ELSE trim($1) END
$$;
ALTER TABLE taxi.viajes ADD COLUMN "idRecorrido" integer REFERENCES taxi.recorridos ON UPDATE CASCADE ON DELETE RESTRICT;
UPDATE taxi.viajes v SET "idRecorrido" = r."idRecorrido"
FROM taxi.recorridos r
JOIN taxi.paradas po ON po."idParada" = r."idParadaOrigen"
JOIN taxi.ciudades co ON co."idCiudad" = po."idCiudad"
JOIN taxi.paradas pd ON pd."idParada" = r."idParadaDestino"
JOIN taxi.ciudades cd ON cd."idCiudad" = pd."idCiudad"
WHERE co.nombre = pg_temp.ciudad_canonica(v.origen) AND cd.nombre = pg_temp.ciudad_canonica(v.destino);

-- Conservar viajes historicos de otros pares como recorridos inactivos.
DO $$
DECLARE v record; ciudad_o integer; ciudad_d integer; parada_o integer; parada_d integer; recorrido integer;
BEGIN
 FOR v IN SELECT * FROM taxi.viajes WHERE "idRecorrido" IS NULL LOOP
  INSERT INTO taxi.ciudades(nombre) VALUES (pg_temp.ciudad_canonica(v.origen)) ON CONFLICT DO NOTHING;
  SELECT "idCiudad" INTO ciudad_o FROM taxi.ciudades WHERE lower(trim(nombre)) = lower(pg_temp.ciudad_canonica(v.origen));
  INSERT INTO taxi.ciudades(nombre) VALUES (pg_temp.ciudad_canonica(v.destino)) ON CONFLICT DO NOTHING;
  SELECT "idCiudad" INTO ciudad_d FROM taxi.ciudades WHERE lower(trim(nombre)) = lower(pg_temp.ciudad_canonica(v.destino));
  INSERT INTO taxi.paradas("idCiudad", nombre, referencia) VALUES (ciudad_o, 'Origen historico', 'Punto exacto pendiente de confirmar') ON CONFLICT DO NOTHING;
  SELECT "idParada" INTO parada_o FROM taxi.paradas WHERE "idCiudad" = ciudad_o AND nombre = 'Origen historico';
  INSERT INTO taxi.paradas("idCiudad", nombre, referencia) VALUES (ciudad_d, 'Destino historico', 'Punto exacto pendiente de confirmar') ON CONFLICT DO NOTHING;
  SELECT "idParada" INTO parada_d FROM taxi.paradas WHERE "idCiudad" = ciudad_d AND nombre = 'Destino historico';
  INSERT INTO taxi.recorridos(codigo, "idParadaOrigen", "idParadaDestino", activo)
   VALUES ('HIST_' || parada_o || '_' || parada_d, parada_o, parada_d, false) ON CONFLICT DO NOTHING;
  SELECT "idRecorrido" INTO recorrido FROM taxi.recorridos WHERE "idParadaOrigen" = parada_o AND "idParadaDestino" = parada_d;
  UPDATE taxi.viajes SET "idRecorrido" = recorrido WHERE "idViaje" = v."idViaje";
 END LOOP;
END $$;
ALTER TABLE taxi.viajes ALTER COLUMN "idRecorrido" SET NOT NULL;
ALTER TABLE taxi.viajes DROP COLUMN origen, DROP COLUMN destino;
CREATE INDEX viajes_recorrido_disponibilidad ON taxi.viajes ("idRecorrido", "estadoViaje", "fechaSalida", "horaSalida");
-- Es un agregado, no un atributo propio del pasajero.
ALTER TABLE taxi.pasajeros DROP COLUMN "cantidadReservas";
CREATE VIEW taxi.estadisticas_pasajeros AS
SELECT p."idPasajero", count(r."idReserva")::integer AS "cantidadReservas"
FROM taxi.pasajeros p LEFT JOIN taxi.reservas r ON r."idPasajero" = p."idPasajero"
GROUP BY p."idPasajero";

REVOKE ALL ON ALL TABLES IN SCHEMA taxi FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA taxi FROM PUBLIC;
DO $$
DECLARE rol text;
BEGIN
 FOREACH rol IN ARRAY ARRAY['anon', 'authenticated'] LOOP
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = rol) THEN
   EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA taxi FROM %I', rol);
   EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA taxi FROM %I', rol);
  END IF;
 END LOOP;
END $$;
