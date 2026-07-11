import { Service, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface DashboardGrupo {
  estado: string;
  cantidad: number;
}

export interface DashboardFecha {
  fecha: string;
  cantidad: number;
}

export interface DashboardData {
  status: string;
  msg: string;
  totales: {
    usuarios: number;
    pasajeros: number;
    choferes: number;
    autos: number;
    viajes: number;
    reservas: number;
  };
  viajesPorEstado: DashboardGrupo[];
  reservasPorEstado: DashboardGrupo[];
  reservasPorFecha: DashboardFecha[];
  choferesPorEstado: DashboardGrupo[];
  pasajerosPorEstado: DashboardGrupo[];
  autosPorEstado: DashboardGrupo[];
  ultimasReservas: any[];
}

@Service()
export class DashboardService {
private baseUrl = 'http://localhost:3000/api';
private http = inject(HttpClient);
private readonly apiUrl = `${this.baseUrl}/admins/dashboard`;

obtenerDashboard(): Observable<DashboardData> {
return this.http.get<DashboardData>(this.apiUrl);
  }
}