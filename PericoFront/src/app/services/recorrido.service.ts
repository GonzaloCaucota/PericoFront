import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_URL } from '../config/api';
import { Recorrido } from '../../models/recorrido.model';

@Injectable({ providedIn: 'root' })
export class RecorridoService {
  private http = inject(HttpClient);
  listar(): Observable<Recorrido[]> {
    return this.http.get<Recorrido[]>(`${API_URL}/recorridos`);
  }
}
