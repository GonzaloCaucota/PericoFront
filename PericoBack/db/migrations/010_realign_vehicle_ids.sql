-- Las importaciones con IDs explicitos pueden dejar atras una secuencia SERIAL.
-- Reparar una sola vez, sin retroceder IDs ni alterar autos o asignaciones.
LOCK TABLE taxi.autos, taxi.turnos_chofer IN SHARE ROW EXCLUSIVE MODE;
DO $$
DECLARE
  item record;
  secuencia regclass;
  maximo bigint;
  ultimo bigint;
  usado boolean;
BEGIN
  FOR item IN SELECT * FROM (VALUES
    ('autos', 'idAuto'), ('turnos_chofer', 'idTurnoChofer')
  ) AS tablas(tabla, columna)
  LOOP
    secuencia := pg_get_serial_sequence(format('taxi.%I', item.tabla), item.columna)::regclass;
    IF secuencia IS NULL THEN RAISE EXCEPTION 'Falta secuencia para %', item.tabla; END IF;
    EXECUTE format('SELECT MAX(%I) FROM taxi.%I', item.columna, item.tabla) INTO maximo;
    EXECUTE format('SELECT last_value, is_called FROM %s', secuencia) INTO ultimo, usado;
    IF maximo IS NOT NULL AND (maximo > ultimo OR (maximo = ultimo AND NOT usado)) THEN
      PERFORM setval(secuencia, maximo, true);
    END IF;
  END LOOP;
END $$;
