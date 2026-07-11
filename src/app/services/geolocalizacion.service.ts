import { Injectable } from '@angular/core';
import { Coordenadas } from './chofer.service';

@Injectable({
  providedIn: 'root'
})
export class GeolocationService {
  obtenerUbicacionActual(): Promise<Coordenadas> {
    // Usa la API nativa del navegador. El usuario debe permitir compartir ubicacion.
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('El navegador no soporta geolocalización.'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitud: position.coords.latitude,
            longitud: position.coords.longitude,
            precision: position.coords.accuracy
          });
        },
        (error) => reject(error),
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    });
  }
}
