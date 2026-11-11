CREATE TABLE taxi.invitados (
 "idInvitado" SERIAL PRIMARY KEY,
 nombre VARCHAR(100) NOT NULL,
 telefono VARCHAR(20) NOT NULL,
 "tokenHash" VARCHAR(64) NOT NULL UNIQUE,
 "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
 "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE taxi.reservas ALTER COLUMN "idPasajero" DROP NOT NULL;
ALTER TABLE taxi.reservas ADD COLUMN "idInvitado" INTEGER UNIQUE REFERENCES taxi.invitados("idInvitado") ON DELETE RESTRICT;
ALTER TABLE taxi.reservas ADD CONSTRAINT reserva_un_titular CHECK (("idPasajero" IS NOT NULL) <> ("idInvitado" IS NOT NULL));
REVOKE ALL ON taxi.invitados FROM PUBLIC;
REVOKE ALL ON SEQUENCE taxi."invitados_idInvitado_seq" FROM PUBLIC;
