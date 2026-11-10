import { API_URL } from '../config/api';
import { Service, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Service()
export class GestionUsuariosService {
    private http = inject(HttpClient);
    private apiUrl = API_URL; 

  actualizarPasajero(idPasajero: number, datosActualizados: any): Observable<any> {
  return this.http.patch(`${this.apiUrl}/pasajeros/${idPasajero}`, datosActualizados);
}

  actualizarChofer(idChofer: number, datosActualizados: any): Observable<any> {

    return this.http.patch(`${this.apiUrl}/choferes/${idChofer}`, datosActualizados);
  }

  obtenerPasajeros(): Observable<any> {
    return this.http.get(`${this.apiUrl}/pasajeros`); 
  }

  obtenerChoferes(): Observable<any> {
    return this.http.get(`${this.apiUrl}/choferes`); 
  }
}
