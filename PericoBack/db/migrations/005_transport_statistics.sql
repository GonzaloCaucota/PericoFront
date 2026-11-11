-- Agregados sobre el historial: evitan contadores duplicados y desactualizados.
CREATE VIEW taxi.estadisticas_viajes_transportados AS
SELECT v."idViaje", v."idChofer", v."idAuto",
       COALESCE(SUM(r."cantidadAsientos") FILTER (WHERE r."estadoReserva" = 'UTILIZADA'), 0)::integer AS "pasajerosTransportados"
FROM taxi.viajes v
LEFT JOIN taxi.reservas r ON r."idViaje" = v."idViaje"
WHERE v."estadoViaje" = 'FINALIZADO'
GROUP BY v."idViaje", v."idChofer", v."idAuto";

CREATE VIEW taxi.estadisticas_choferes AS
SELECT e."idChofer", COUNT(t."idViaje")::integer AS "viajesRealizados",
       COALESCE(SUM(t."pasajerosTransportados"), 0)::integer AS "pasajerosTransportados"
FROM taxi.choferes e
LEFT JOIN taxi.estadisticas_viajes_transportados t ON t."idChofer" = e."idChofer"
GROUP BY e."idChofer";

CREATE VIEW taxi.estadisticas_autos AS
SELECT e."idAuto", COUNT(t."idViaje")::integer AS "viajesRealizados",
       COALESCE(SUM(t."pasajerosTransportados"), 0)::integer AS "pasajerosTransportados"
FROM taxi.autos e
LEFT JOIN taxi.estadisticas_viajes_transportados t ON t."idAuto" = e."idAuto"
GROUP BY e."idAuto";

REVOKE ALL ON taxi.estadisticas_viajes_transportados, taxi.estadisticas_choferes, taxi.estadisticas_autos FROM PUBLIC;
DO $$
DECLARE rol text;
BEGIN
 FOREACH rol IN ARRAY ARRAY['anon', 'authenticated'] LOOP
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = rol) THEN
   EXECUTE format('REVOKE ALL ON taxi.estadisticas_viajes_transportados, taxi.estadisticas_choferes, taxi.estadisticas_autos FROM %I', rol);
  END IF;
 END LOOP;
END $$;
