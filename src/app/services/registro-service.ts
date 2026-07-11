import { Service, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import type { RegistroPasajeroDTO } from '../../models/registroPasajero.dto';
import type { RegistroChoferDTO } from '../../models/registroChofer.dto';
import type { RegistroAdminDTO } from '../../models/registroAdmin.dto';


export type { RegistroPasajeroDTO, RegistroChoferDTO, RegistroAdminDTO };

@Service()
export class RegistroService {
  private http = inject(HttpClient); 
  
  private apiUrl = 'http://localhost:3000/api';

  registrarPasajero(data: RegistroPasajeroDTO): Observable<any> {
    return this.http.post(`${this.apiUrl}/pasajeros`, data);
  }

  registrarChofer(data: RegistroChoferDTO): Observable<any> {
    return this.http.post(`${this.apiUrl}/choferes`, data);
  }

  registrarAdmin(data: RegistroAdminDTO): Observable<any> {
    return this.http.post(`${this.apiUrl}/admins`, data);
  }
}