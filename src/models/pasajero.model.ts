import type { Usuario } from './usuario.model';
import type { Reserva } from './reserva.model';

export type Decimal = number | string;

export interface Pasajero {
  idPasajero: number;
  idUsuario: number;
  calificacion: Decimal;
  cantidadReservas: number;
  estadoPasajero: 'ACTIVO' | 'SUSPENDIDO' | 'BLOQUEADO' | 'ELIMINADO';
  latitud?: Decimal | null;
  longitud?: Decimal | null;
  precision?: Decimal | null;
  createdAt?: string;
  updatedAt?: string;
  usuario?: Usuario;
  reservas?: Reserva[];
}

export type CrearPasajeroDTO = Omit<Pasajero, 'idPasajero' | 'createdAt' | 'updatedAt' | 'usuario' | 'reservas'>;