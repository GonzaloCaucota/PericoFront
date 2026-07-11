import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Pasajero } from '../../models/pasajero.model';
import { Viaje } from '../../models/viaje.model';
import { Reserva } from '../../models/reserva.model';
import { ChoferModel } from '../../models/chofer.model';

export interface CrearReservaDto {
  idPasajero: number;
  idViaje: number;
  cantidadAsientos: number;
  importeTotal: number;
  estadoReserva: 'PENDIENTE' | 'CONFIRMADA';
  estadoPago: 'PENDIENTE' | 'PAGADO';
}

@Injectable({
  providedIn: 'root'
})
export class PasajeroService {
  private baseUrl = 'http://localhost:3000/api';

  constructor(private _http: HttpClient) {}

  // Service de API para el panel del pasajero: viajes, reservas, historial y cancelacion.
  getPasajeroById(idPasajero: number): Observable<Pasajero> {
    return this._http.get<Pasajero>(`${this.baseUrl}/pasajeros/${idPasajero}`);
  }

  getChoferById(idChofer: number): Observable<ChoferModel> {
    return this._http.get<ChoferModel>(`${this.baseUrl}/choferes/${idChofer}`);
  }

  getViajesDisponibles(origen: string, destino: string): Observable<Viaje[]> {
    // El backend filtra por origen, destino, estado de viaje y asientos disponibles.
    const params = new HttpParams()
      .set('origen', origen)
      .set('destino', destino);

    return this._http.get<Viaje[]>(`${this.baseUrl}/viajes/disponibles`, {
      params
    });
  }

  crearReserva(
    reserva: CrearReservaDto,
    tipoCanal: 'LINK' | 'QR' | 'EFECTIVO'
  ): Observable<any> {
    // tipoCanal decide si el backend genera link de Mercado Pago, QR o reserva en efectivo.
    return this._http.post<any>(
      `${this.baseUrl}/reservas?tipoCanal=${tipoCanal}`,
      reserva
    );
  }

  actualizarAsientosDisponibles(idViaje: number, asientosDisponibles: number): Observable<any> {
    return this._http.post<any>(`${this.baseUrl}/viajes/${idViaje}/actualizar-asientos-disponibles`, {
      asientosDisponibles
    });
  }

  getHistorialPasajero(idPasajero: number): Observable<Reserva[]> {
    return this._http.get<Reserva[]>(`${this.baseUrl}/pasajeros/${idPasajero}/historial`);
  }

  cancelarReserva(idReserva: number): Observable<any> {
    return this._http.patch<any>(`${this.baseUrl}/reservas/${idReserva}/cancelar`, {});
  }
}
