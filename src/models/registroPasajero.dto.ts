export interface RegistroPasajeroDTO {
  nombre: string;
  apellido: string;
  email: string;
  passwordHash: string;
  telefono: string;
  activo?: boolean;
  calificacion?: number;
  cantidadReservas?: number;
  estadoPasajero?: 'ACTIVO' | 'SUSPENDIDO' | 'BLOQUEADO' | 'ELIMINADO';
}
