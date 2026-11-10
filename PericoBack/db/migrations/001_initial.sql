-- Esquema inicial: conservar este archivo inmutable una vez aplicado.
CREATE SCHEMA IF NOT EXISTS taxi;
SET LOCAL search_path TO taxi, public;

DO 'BEGIN CREATE TYPE "taxi"."enum_usuarios_rol" AS ENUM(''PASAJERO'', ''CHOFER'', ''ADMIN''); EXCEPTION WHEN duplicate_object THEN null; END';
DO 'BEGIN CREATE TYPE "taxi"."enum_pasajeros_estadoPasajero" AS ENUM(''ACTIVO'', ''SUSPENDIDO'', ''BLOQUEADO'', ''ELIMINADO''); EXCEPTION WHEN duplicate_object THEN null; END';
DO 'BEGIN CREATE TYPE "taxi"."enum_choferes_estadoChofer" AS ENUM(''DISPONIBLE'', ''EN_VIAJE'', ''DESCANSO'', ''SUSPENDIDO'', ''INACTIVO'', ''ELIMINADO''); EXCEPTION WHEN duplicate_object THEN null; END';
DO 'BEGIN CREATE TYPE "taxi"."enum_admins_estadoAdmin" AS ENUM(''ACTIVO'', ''SUSPENDIDO'', ''INACTIVO'', ''ELIMINADO''); EXCEPTION WHEN duplicate_object THEN null; END';
DO 'BEGIN CREATE TYPE "taxi"."enum_autos_estado" AS ENUM(''DISPONIBLE'', ''EN_VIAJE'', ''EN_TALLER'', ''INACTIVO''); EXCEPTION WHEN duplicate_object THEN null; END';
DO 'BEGIN CREATE TYPE "taxi"."enum_viajes_estadoViaje" AS ENUM(''ABIERTO'', ''COMPLETO'', ''EN_CURSO'', ''FINALIZADO'', ''CANCELADO''); EXCEPTION WHEN duplicate_object THEN null; END';
DO 'BEGIN CREATE TYPE "taxi"."enum_reservas_estadoReserva" AS ENUM(''PENDIENTE'', ''CONFIRMADA'', ''CANCELADA'', ''UTILIZADA'', ''NO_PRESENTADO''); EXCEPTION WHEN duplicate_object THEN null; END';
DO 'BEGIN CREATE TYPE "taxi"."enum_reservas_estadoPago" AS ENUM(''PENDIENTE'', ''PAGADO'', ''REEMBOLSADO''); EXCEPTION WHEN duplicate_object THEN null; END';
DO 'BEGIN CREATE TYPE "taxi"."enum_auditorias_accion" AS ENUM(''CREATE'', ''UPDATE'', ''DELETE''); EXCEPTION WHEN duplicate_object THEN null; END';

CREATE TABLE "taxi"."usuarios" ("idUsuario"  SERIAL , "nombre" VARCHAR(50) NOT NULL, "apellido" VARCHAR(50) NOT NULL, "email" VARCHAR(100) NOT NULL UNIQUE, "passwordHash" VARCHAR(255) NOT NULL, "telefono" VARCHAR(20) NOT NULL, "activo" BOOLEAN DEFAULT true, "rol" "taxi"."enum_usuarios_rol" NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL, PRIMARY KEY ("idUsuario"));

CREATE TABLE "taxi"."pasajeros" ("idPasajero"  SERIAL , "idUsuario" INTEGER NOT NULL UNIQUE REFERENCES "taxi"."usuarios" ("idUsuario") ON DELETE CASCADE ON UPDATE CASCADE, "calificacion" DECIMAL(3,2) DEFAULT 0, "cantidadReservas" INTEGER DEFAULT 0, "estadoPasajero" "taxi"."enum_pasajeros_estadoPasajero" NOT NULL DEFAULT 'ACTIVO', "latitud" DECIMAL(10,8), "longitud" DECIMAL(11,8), "precision" DECIMAL(10,2), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL, PRIMARY KEY ("idPasajero"));

CREATE TABLE "taxi"."choferes" ("idChofer"  SERIAL , "idUsuario" INTEGER NOT NULL UNIQUE REFERENCES "taxi"."usuarios" ("idUsuario") ON DELETE CASCADE ON UPDATE CASCADE, "licenciaConducir" VARCHAR(50) NOT NULL UNIQUE, "estadoChofer" "taxi"."enum_choferes_estadoChofer" NOT NULL DEFAULT 'DISPONIBLE', "fechaHabilitacion" DATE NOT NULL, "calificacion" DECIMAL(3,2) DEFAULT 0, "latitud" DECIMAL(10,8), "longitud" DECIMAL(11,8), "precision" DECIMAL(10,2), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL, PRIMARY KEY ("idChofer"));

CREATE TABLE "taxi"."admins" ("idAdmin"  SERIAL , "idUsuario" INTEGER NOT NULL UNIQUE REFERENCES "taxi"."usuarios" ("idUsuario") ON DELETE CASCADE ON UPDATE CASCADE, "estadoAdmin" "taxi"."enum_admins_estadoAdmin" NOT NULL DEFAULT 'ACTIVO', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL, PRIMARY KEY ("idAdmin"));

CREATE TABLE "taxi"."autos" ("idAuto"  SERIAL , "patente" VARCHAR(255) NOT NULL UNIQUE, "marca" VARCHAR(255) NOT NULL, "modelo" VARCHAR(255) NOT NULL, "capacidadAsientos" INTEGER NOT NULL, "estado" "taxi"."enum_autos_estado" NOT NULL DEFAULT 'DISPONIBLE', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL, PRIMARY KEY ("idAuto"));

CREATE TABLE "taxi"."turnos_chofer" ("idTurnoChofer"  SERIAL , "idChofer" INTEGER NOT NULL REFERENCES "taxi"."choferes" ("idChofer") ON DELETE CASCADE ON UPDATE CASCADE, "idAuto" INTEGER NOT NULL REFERENCES "taxi"."autos" ("idAuto") ON DELETE CASCADE ON UPDATE CASCADE, "fecha" DATE NOT NULL, "horaInicio" TIME NOT NULL, "horaFin" TIME NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL, PRIMARY KEY ("idTurnoChofer"));

CREATE TABLE "taxi"."viajes" ("idViaje"  SERIAL , "origen" VARCHAR(255) NOT NULL, "destino" VARCHAR(255) NOT NULL, "fechaSalida" DATE NOT NULL, "horaSalida" TIME NOT NULL, "tarifaPorAsiento" DECIMAL(10,2) NOT NULL, "asientosDisponibles" INTEGER NOT NULL, "estadoViaje" "taxi"."enum_viajes_estadoViaje" NOT NULL DEFAULT 'ABIERTO', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL, "idChofer" INTEGER NOT NULL REFERENCES "taxi"."choferes" ("idChofer") ON DELETE RESTRICT ON UPDATE CASCADE, "idAuto" INTEGER NOT NULL REFERENCES "taxi"."autos" ("idAuto") ON DELETE RESTRICT ON UPDATE CASCADE, PRIMARY KEY ("idViaje"));

CREATE TABLE "taxi"."reservas" ("idReserva"  SERIAL , "idPasajero" INTEGER NOT NULL REFERENCES "taxi"."pasajeros" ("idPasajero") ON DELETE CASCADE ON UPDATE CASCADE, "idViaje" INTEGER NOT NULL REFERENCES "taxi"."viajes" ("idViaje") ON DELETE CASCADE ON UPDATE CASCADE, "cantidadAsientos" INTEGER NOT NULL, "importeTotal" DECIMAL(10,2) NOT NULL, "estadoReserva" "taxi"."enum_reservas_estadoReserva" NOT NULL DEFAULT 'PENDIENTE', "estadoPago" "taxi"."enum_reservas_estadoPago" NOT NULL DEFAULT 'PENDIENTE', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL, PRIMARY KEY ("idReserva"));

CREATE TABLE "taxi"."auditorias" ("idAuditoria"  SERIAL , "tablaAfectada" VARCHAR(255) NOT NULL, "accion" "taxi"."enum_auditorias_accion" NOT NULL, "registroId" VARCHAR(255) NOT NULL, "valoresAnteriores" JSON, "valoresNuevos" JSON, "usuarioResponsable" VARCHAR(255), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL, PRIMARY KEY ("idAuditoria"));
