import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ChoferModel } from '../../models/chofer.model';
import { Auto } from '../../models/auto.model';
import { Viaje } from '../../models/viaje.model';

export interface CrearViajeDto {
  origen: string;
  destino: string;
  fechaSalida: string;
  horaSalida: string;
  tarifaPorAsiento: number;
  idChofer: number;
  idAuto: number;
}

export interface Coordenadas {
  latitud: number;
  longitud: number;
  precision?: number;
}

export interface CrearAutoDto {
  patente: string;
  marca: string;
  modelo: string;
  capacidadAsientos: number;
  estado?: 'DISPONIBLE' | 'EN_VIAJE' | 'EN_TALLER' | 'INACTIVO';
}

export interface CrearTurnoChoferDto {
  idChofer: number;
  idAuto: number;
  fecha: string;
  horaInicio: string;
  horaFin: string;
}

@Injectable({
  providedIn: 'root'
})
export class ChoferService {
  private baseUrl = 'http://localhost:3000/api';

  constructor(private _http: HttpClient) {}

  // Este service concentra las llamadas HTTP que usa la pantalla del chofer.
  getChoferes(): Observable<ChoferModel[]> {
    return this._http.get<ChoferModel[]>(`${this.baseUrl}/choferes`);
  }

  getAutos(): Observable<Auto[]> {
    return this._http.get<Auto[]>(`${this.baseUrl}/autos`);
  }

  crearAuto(auto: CrearAutoDto): Observable<{ status: string; msg: string; auto: Auto }> {
    return this._http.post<{ status: string; msg: string; auto: Auto }>(`${this.baseUrl}/autos`, auto);
  }

  actualizarAuto(idAuto: number, auto: CrearAutoDto): Observable<any> {
    return this._http.put<any>(`${this.baseUrl}/autos/${idAuto}`, auto);
  }

  cambiarEstadoAuto(idAuto: number, estado: string): Observable<any> {
    return this._http.patch<any>(`${this.baseUrl}/autos/${idAuto}/estado`, { estado });
  }

  crearTurnoChofer(turno: CrearTurnoChoferDto): Observable<any> {
    return this._http.post<any>(`${this.baseUrl}/turnos`, turno);
  }

  getChoferById(idChofer: number): Observable<ChoferModel> {
    return this._http.get<ChoferModel>(`${this.baseUrl}/choferes/${idChofer}`);
  }

  updateEstadoChofer(idChofer: number, estadoChofer: string): Observable<any> {
    return this._http.patch<any>(`${this.baseUrl}/choferes/${idChofer}/estado`, {
      estadoChofer
    });
  }

  getAutosByChofer(idChofer: number): Observable<Auto[]> {
    return this._http.get<Auto[]>(`${this.baseUrl}/choferes/${idChofer}/autos`);
  }

  getViajesDelChofer(idChofer: number): Observable<Viaje[]> {
    return this._http.get<Viaje[]>(`${this.baseUrl}/choferes/${idChofer}/viajes`);
  }

  crearViaje(nuevoViaje: CrearViajeDto): Observable<any> {
    return this._http.post<any>(`${this.baseUrl}/viajes`, nuevoViaje);
  }

  cambiarEstadoViaje(idViaje: number, estado: string): Observable<any> {
    return this._http.patch<any>(`${this.baseUrl}/viajes/${idViaje}/estado`, {
      estado
    });
  }

  actualizarAsientosDisponibles(idViaje: number, asientosDisponibles: number): Observable<Viaje> {
    return this._http.post<Viaje>(`${this.baseUrl}/viajes/${idViaje}/actualizar-asientos-disponibles`, {
      asientosDisponibles
    });
  }

  generarQrCobro(idReserva: number): Observable<any> {
    // Pide al backend un QR de Mercado Pago para una reserva pendiente.
    return this._http.post<any>(`${this.baseUrl}/reservas/${idReserva}/qr`, {});
  }

  registrarPagoEfectivo(idReserva: number): Observable<any> {
    return this._http.put<any>(`${this.baseUrl}/reservas/${idReserva}/pago-efectivo`, {});
  }

  actualizarUbicacion(
    idChofer: number,
    ubicacion: Coordenadas
  ): Observable<{ status: string; msg: string; chofer: ChoferModel }> {
    return this._http.patch<{ status: string; msg: string; chofer: ChoferModel }>(
      `${this.baseUrl}/choferes/${idChofer}/ubicacion`,
      ubicacion
    );
  }
}
