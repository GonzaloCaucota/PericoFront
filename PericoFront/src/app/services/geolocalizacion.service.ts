import { Injectable } from '@angular/core';
import { Coordenadas } from './chofer.service';

@Injectable({ providedIn: 'root' })
export class GeolocationService {
  // Una estimacion a varias cuadras no sirve como punto de encuentro.
  private readonly precisionMaxima = 200;

  obtenerUbicacionActual(): Promise<Coordenadas> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('El navegador no soporta geolocalización.'));
        return;
      }
      const solicitar = (reintento: boolean, altaPrecision: boolean) => {
        navigator.geolocation.getCurrentPosition(position => {
          const { latitude, longitude, accuracy } = position.coords;
          const valida = [latitude, longitude, accuracy].every(Number.isFinite)
            && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180 && accuracy >= 0;
          if (!valida || accuracy > this.precisionMaxima) {
            if (!reintento) { solicitar(true, true); return; }
            const margen = Number.isFinite(accuracy) ? ` (margen estimado: ${Math.ceil(accuracy)} m)` : '';
            reject(new Error(`El navegador no pudo obtener una ubicación suficientemente precisa${margen}. No se envió una nueva posición. Activá la ubicación del dispositivo y volvé a intentar; en una computadora puede funcionar mejor desde el celular.`));
            return;
          }
          resolve({ latitud: latitude, longitud: longitude, precision: accuracy });
        }, error => {
          if (!reintento && (error.code === 2 || error.code === 3)) { solicitar(true, false); return; }
          reject(new Error(error.code === 1 ? 'Habilitá el permiso de ubicación de este sitio en el navegador.'
            : error.code === 3 ? 'Se agotó el tiempo para obtener la ubicación. Activá la ubicación del dispositivo y volvé a intentar.'
            : 'El dispositivo no pudo determinar tu ubicación. Verificá la ubicación y la conexión e intentá nuevamente.'));
        }, { enableHighAccuracy: altaPrecision, timeout: reintento ? 20000 : 10000, maximumAge: 0 });
      };
      solicitar(false, true);
    });
  }
}
