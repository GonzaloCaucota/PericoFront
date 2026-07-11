import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

export interface CoordenadaMapa {
  latitud: number;
  longitud: number;
}

@Injectable({
  providedIn: 'root'
})
export class RutaService {
  private osrmUrl = 'https://router.project-osrm.org/route/v1/driving';

  constructor(private _http: HttpClient) {}

  obtenerRuta(origen: CoordenadaMapa, destino: CoordenadaMapa): Observable<any> {
    // OSRM calcula la ruta por calles entre pasajero y chofer y devuelve GeoJSON.
    const coordenadas = `${origen.longitud},${origen.latitud};${destino.longitud},${destino.latitud}`;

    return this._http.get<any>(`${this.osrmUrl}/${coordenadas}`, {
      params: {
        overview: 'full',
        geometries: 'geojson',
        steps: 'true'
      }
    });
  }
}
