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
  altaUsuario(tipo: 'CHOFER' | 'PASAJERO', datos: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/admins/${tipo === 'CHOFER' ? 'choferes' : 'pasajeros'}`, datos);
  }
  moderar(tipo: 'choferes' | 'pasajeros', id: number, accion: string, motivo: string): Observable<any> {
    return this.http.patch(`${this.apiUrl}/admins/${tipo}/${id}/${accion}`, { motivo });
  }
  obtenerAutos(): Observable<any[]> { return this.http.get<any[]>(`${this.apiUrl}/autos`); }
  habilitarAuto(id: number, estado: string, motivo: string): Observable<any> {
    return this.http.patch(`${this.apiUrl}/admins/autos/${id}/habilitacion`, { estado, motivo });
  }
}
