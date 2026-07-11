import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';

@Injectable({
  providedIn: 'root'
})
export class SocketService {
  private socket: Socket;

  constructor() {
    // Socket.IO mantiene una conexion viva con el backend para recibir cambios en tiempo real.
    this.socket = io('http://localhost:3000', {
      transports: ['websocket']
    });
  }

  unirsePasajero(idPasajero: number): void {
    this.socket.emit('unirse_pasajero', idPasajero);
  }

  unirseChofer(idChofer: number): void {
    this.socket.emit('unirse_chofer', idChofer);
  }

  unirseViaje(idViaje: number): void {
    this.socket.emit('unirse_viaje', idViaje);
  }

  unirseReserva(idReserva: number): void {
    this.socket.emit('unirse_reserva', idReserva);
  }

  escuchar<T>(evento: string, callback: (data: T) => void): void {
    // Los componentes se suscriben a eventos como pago_confirmado_reserva_15 o viaje_actualizado_3.
    this.socket.on(evento, callback);
  }

  dejarDeEscuchar(evento: string): void {
    this.socket.off(evento);
  }

  desconectar(): void {
    this.socket.disconnect();
  }
}
