import type { Usuario } from './usuario.model';
import type { Auto } from './auto.model';
import type { Viaje } from './viaje.model';

export type Decimal = number | string;

export interface ChoferModel {
  idChofer: number;
  idUsuario: number;
  licenciaConducir: string;
  estadoChofer: 'DISPONIBLE' | 'EN_VIAJE' | 'DESCANSO' | 'SUSPENDIDO' | 'INACTIVO' | 'ELIMINADO';
  fechaHabilitacion: string; 
  calificacion: Decimal;
  latitud?: Decimal | null;
  longitud?: Decimal | null;
  precision?: Decimal | null;
  createdAt?: string;
  updatedAt?: string;
  usuario?: Usuario;
  autos?: Auto[];
  viajes?: Viaje[];
}

export type CrearChoferDTO = Omit<ChoferModel, 'idChofer' | 'createdAt' | 'updatedAt' | 'usuario' | 'autos' | 'viajes'>;