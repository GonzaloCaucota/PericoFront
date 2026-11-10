export interface Auto {
  idAuto: number;
  patente: string;
  marca: string;
  modelo: string;
  capacidadAsientos: number;
  estadoAuto: 'DISPONIBLE' | 'EN_VIAJE' | 'EN_TALLER' | 'INACTIVO';
}