import { Injectable } from '@angular/core';
import { Coordenadas } from './chofer.service';

@Injectable({
  providedIn: 'root'
})
export class GeolocationService {
  obtenerUbicacionActual(): Promise<Coordenadas> {
    // Usa la API nativa del navegador con reintento sin alta precision si falla por senal/tiempo.
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('El navegador no soporta geolocalización.'));
        return;
      }

      const solicitar = (altaPrecision: boolean) => {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            resolve({
              latitud: position.coords.latitude,
              longitud: position.coords.longitude,
              precision: position.coords.accuracy
            });
          },
          (error) => {
            if (altaPrecision && (error.code === 2 || error.code === 3)) {
              solicitar(false);
              return;
            }
            reject(error);
          },
          {
            enableHighAccuracy: altaPrecision,
            timeout: altaPrecision ? 10000 : 20000,
            maximumAge: altaPrecision ? 0 : 300000
          }
        );
      };

      solicitar(true);
    });
  }
}
