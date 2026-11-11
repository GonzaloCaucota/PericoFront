import { API_ORIGIN } from '../config/api';
import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';

@Injectable({
  providedIn: 'root'
})
export class SocketService {
  private socket: Socket;
  private ultimoToken: string | null = null;

  constructor() {
    // Socket.IO mantiene una conexion viva con el backend para recibir cambios en tiempo real.
    this.socket = io(API_ORIGIN, {
      transports: ['websocket', 'polling'],
      auth: callback => callback({ token: sessionStorage.getItem('token') }),
      autoConnect: false
    });
  }

  private asegurarConexionActualizada(): void {
    const tokenActual = sessionStorage.getItem('token');
    if (this.socket.connected && this.ultimoToken !== tokenActual) {
      this.socket.disconnect();
    }
    if (!this.socket.connected) {
      this.ultimoToken = tokenActual;
      this.socket.connect();
    }
  }

  unirsePasajero(idPasajero: number): void {
    this.asegurarConexionActualizada();
    this.socket.emit('unirse_pasajero', idPasajero);
  }

  unirseChofer(idChofer: number): void {
    this.asegurarConexionActualizada();
    this.socket.emit('unirse_chofer', idChofer);
  }

  unirseViaje(idViaje: number): void {
    this.asegurarConexionActualizada();
    this.socket.emit('unirse_viaje', idViaje);
  }

  unirseReserva(idReserva: number): void {
    this.asegurarConexionActualizada();
    this.socket.emit('unirse_reserva', idReserva);
  }

  escuchar<T>(evento: string, callback: (data: T) => void): void {
    // Los componentes se suscriben a eventos como pago_confirmado_reserva_15 o viaje_actualizado_3.
    this.asegurarConexionActualizada();
    this.socket.off(evento);
    this.socket.on(evento, callback);
  }

  dejarDeEscuchar(evento: string): void {
    this.socket.off(evento);
  }

  desconectar(): void {
    this.socket.disconnect();
  }
}
