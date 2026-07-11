import {
  AfterViewInit,
  Component,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges
} from '@angular/core';
import * as L from 'leaflet';

export interface PuntoMapa {
  latitud: number;
  longitud: number;
  etiqueta?: string;
  tipo?: 'chofer' | 'pasajero';
}

@Component({
  selector: 'app-mapa-ruta',
  standalone: true,
  templateUrl: './mapa-ruta.html',
  styleUrl: './mapa-ruta.scss'
})
export class MapaRutaComponent implements AfterViewInit, OnChanges, OnDestroy {
  // Componente reutilizable: recibe puntos y una ruta, y Leaflet se encarga de dibujar el mapa.
  @Input() idMapa = 'mapa';
  @Input() chofer?: PuntoMapa;
  @Input() pasajero?: PuntoMapa;
  @Input() rutaGeoJson?: GeoJSON.LineString;

  private mapa?: L.Map;
  private marcadorChofer?: L.Marker;
  private marcadorPasajero?: L.Marker;
  private rutaLayer?: L.GeoJSON;

  ngAfterViewInit(): void {
    this.crearMapa();
    this.renderizar();
  }

  ngOnChanges(changes: SimpleChanges): void {
    this.renderizar();
  }

  ngOnDestroy(): void {
    this.mapa?.remove();
  }

  private crearMapa(): void {
    if (this.mapa) return;

    // Leaflet usa tiles publicos de OpenStreetMap como fondo del mapa.
    const centro: L.LatLngExpression = [-24.256, -65.211];
    this.mapa = L.map(this.idMapa, {
      zoomControl: true
    }).setView(centro, 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(this.mapa);
  }

  private renderizar(): void {
    if (!this.mapa) return;

    // Cada cambio de inputs vuelve a dibujar marcadores/ruta para evitar datos viejos.
    this.marcadorChofer?.remove();
    this.marcadorPasajero?.remove();
    this.rutaLayer?.remove();

    const puntos: L.LatLngExpression[] = [];

    if (this.chofer) {
      const posicion: L.LatLngExpression = [this.chofer.latitud, this.chofer.longitud];
      this.marcadorChofer = L.marker(posicion, {
        icon: this.crearIcono('chofer')
      })
        .addTo(this.mapa)
        .bindPopup(this.chofer.etiqueta || 'Chofer');

      puntos.push(posicion);
    }

    if (this.pasajero) {
      const posicion: L.LatLngExpression = [this.pasajero.latitud, this.pasajero.longitud];
      this.marcadorPasajero = L.marker(posicion, {
        icon: this.crearIcono('pasajero')
      })
        .addTo(this.mapa)
        .bindPopup(this.pasajero.etiqueta || 'Tu ubicacion');

      puntos.push(posicion);
    }

    if (this.rutaGeoJson) {
      this.rutaLayer = L.geoJSON(this.rutaGeoJson as any, {
        style: {
          color: '#0d6efd',
          weight: 5,
          opacity: .9
        }
      }).addTo(this.mapa);
    }

    if (this.rutaLayer) {
      // Si hay ruta calculada, el mapa se ajusta a esa ruta completa.
      this.mapa.fitBounds(this.rutaLayer.getBounds(), {
        padding: [28, 28],
        maxZoom: 15
      });
    } else if (puntos.length > 1) {
      this.mapa.fitBounds(L.latLngBounds(puntos), {
        padding: [28, 28],
        maxZoom: 15
      });
    } else if (puntos.length === 1) {
      this.mapa.setView(puntos[0], 15);
    }

    setTimeout(() => this.mapa?.invalidateSize(), 120);
  }

  private crearIcono(tipo: 'chofer' | 'pasajero'): L.DivIcon {
    const clase = tipo === 'chofer' ? 'bg-primary' : 'bg-success';
    const icono = tipo === 'chofer' ? 'bi-car-front-fill' : 'bi-person-fill';

    return L.divIcon({
      className: '',
      html: `<div class="map-marker ${clase}"><i class="bi ${icono}"></i></div>`,
      iconSize: [34, 34],
      iconAnchor: [17, 17],
      popupAnchor: [0, -18]
    });
  }
}
