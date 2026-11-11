import { Recorrido } from './recorrido.model';
export interface Viaje {
  idViaje: number;
  idRecorrido: number;
  recorrido?: Recorrido;
  origen: string;
  destino: string;
  fechaSalida: Date;
  horaSalida: string; // Formato "HH:mm"
  tarifaPorAsiento: number;
  asientosDisponibles: number;
  estadoViaje: 'ABIERTO' | 'COMPLETO' | 'EN_CURSO' | 'FINALIZADO' | 'CANCELADO';
  fechaCreacion: Date;
}