export interface Parada {
  idParada: number;
  idCiudad: number;
  nombre: string;
  referencia: string | null;
  ubicacionConfirmada: boolean;
  ciudad: { idCiudad: number; nombre: string };
}

export interface Recorrido {
  idRecorrido: number;
  codigo: string;
  activo: boolean;
  origen: string;
  destino: string;
  paradaOrigen: Parada;
  paradaDestino: Parada;
}
