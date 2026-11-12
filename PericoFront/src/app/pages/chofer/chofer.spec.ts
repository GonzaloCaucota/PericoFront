import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Chofer } from './chofer';
import { API_URL } from '../../config/api';
import { GeolocationService } from '../../services/geolocalizacion.service';

describe('Chofer', () => {
  let component: Chofer;
  let fixture: ComponentFixture<Chofer>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([{ path: '**', children: [] }])],
      imports: [Chofer],
    }).compileComponents();

    fixture = TestBed.createComponent(Chofer);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
  it('confirma antes de quitar un manual y envia la accion, no una disponibilidad desactualizada', () => {
    component.viajeActual = { idViaje: 3, asientosDisponibles: 1, estadoViaje: 'EN_CURSO', auto: { capacidadAsientos: 4 }, reservas: [{ cantidadAsientos: 2, estadoReserva: 'CONFIRMADA' }] } as any;
    expect(component.pasajerosManuales).toBe(1);
    const http = TestBed.inject(HttpTestingController);
    component.quitarPasajeroManual();
    http.expectNone(`${API_URL}/viajes/3/actualizar-asientos-disponibles`);
    component.confirmarAccionModal();
    const req = http.expectOne(`${API_URL}/viajes/3/actualizar-asientos-disponibles`);
    expect(req.request.body).toEqual({ accionManual: 'QUITAR' });
    component.confirmarAccionModal();
    http.expectNone(`${API_URL}/viajes/3/actualizar-asientos-disponibles`);
    req.flush({ viaje: { ...component.viajeActual, asientosDisponibles: 2 } });
    http.expectOne(`${API_URL}/choferes/${component.idChofer}/viajes`).flush([component.viajeActual]);
    expect(component.pasajerosManuales).toBe(0);
    expect(component.actualizandoPasajeros).toBe(false);
  });
  it('no ofrece quitar cuando toda la ocupacion corresponde a reservas', () => {
    component.viajeActual = { idViaje: 3, asientosDisponibles: 2, estadoViaje: 'ABIERTO', auto: { capacidadAsientos: 4 }, reservas: [{ cantidadAsientos: 2, estadoReserva: 'CONFIRMADA' }] } as any;
    component.quitarPasajeroManual();
    expect(component.confirmacionModal.accion).toBeNull();
    expect(component.pasajerosManuales).toBe(0);
  });

  it('no reenvia una posicion anterior si falla la lectura actual', async () => {
    component.latitud = -24.2;
    component.longitud = -65.3;
    component.precision = 20;
    TestBed.inject(GeolocationService).obtenerUbicacionActual = () => Promise.reject(new Error('Ubicacion imprecisa.'));
    component.enviarUbicacion();
    await Promise.resolve();
    await Promise.resolve();
    TestBed.inject(HttpTestingController).expectNone(`${API_URL}/choferes/${component.idChofer}/ubicacion`);
    expect(component.cargandoUbicacion).toBe(false);
    expect(component.errorUbicacion).toBe('Ubicacion imprecisa.');
  });

});
