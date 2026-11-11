export interface Reserva {
  idReserva: number;
  invitado?: { nombre: string; telefono: string; latitud?: number; longitud?: number; precision?: number; ubicacionActualizadaAt?: string };
  cantidadAsientos: number;
  fechaReserva: Date;
  importeTotal: number;
  estadoReserva: 'PENDIENTE' | 'CONFIRMADA' | 'CANCELADA' | 'UTILIZADA' | 'NO_PRESENTADO'; 
  estadoPago: 'PENDIENTE' | 'PAGADO' | 'REEMBOLSADO';
  fechaActualizacion: Date;
  idviaje: number;
}