export interface Reserva {
  idReserva: number;
  cantidadAsientos: number;
  fechaReserva: Date;
  importeTotal: number;
  estadoReserva: 'PENDIENTE' | 'CONFIRMADA' | 'CANCELADA' | 'UTILIZADA' | 'NO_PRESENTADO'; 
  estadoPago: 'PENDIENTE' | 'PAGADO' | 'REEMBOLSADO';
  fechaActualizacion: Date;
  idviaje: number;
}