import { vi } from 'vitest';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Chofer } from './chofer';
import { API_URL } from '../../config/api';

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

  it('resuelve el perfil con la ruta propia y no con el listado administrativo', () => {
    const http = TestBed.inject(HttpTestingController);
    http.expectOne(`${API_URL}/choferes/mi-perfil`);
    http.expectNone(`${API_URL}/choferes`);
  });
  it('conserva todos los viajes activos y permite seleccionar otro', () => {
    const http = TestBed.inject(HttpTestingController);
    const viajes = [
      { idViaje: 1, estadoViaje: 'ABIERTO', reservas: [] },
      { idViaje: 2, estadoViaje: 'EN_CURSO', reservas: [] },
      { idViaje: 3, estadoViaje: 'FINALIZADO', reservas: [] }
    ];
    component.idChofer = 3;
    component.loadViajes();
    http.expectOne(`${API_URL}/choferes/3/viajes`).flush(viajes);
    expect(component.viajesActivos.length).toBe(2);
    expect(component.viajesHistorial.length).toBe(1);
    component.seleccionarViaje(2);
    http.expectOne(`${API_URL}/choferes/3/viajes`).flush(viajes);
    expect(component.viajeActual?.idViaje).toBe(2);
  });
  it('registra y asocia el auto en un solo pedido y evita el doble envio', () => {
    component.autos = [];
    component.idChofer = 3;
    component.autoForm = { patente: 'AB123CD', marca: 'Fiat', modelo: 'Cronos', capacidadAsientos: 4, estado: 'DISPONIBLE' };
    component.guardarAuto();
    component.guardarAuto();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne(`${API_URL}/autos`).flush({ auto: { idAuto: 8 }, asociadoAlChofer: true });
    http.expectNone(`${API_URL}/turnos`);
    http.expectOne(`${API_URL}/choferes/3/autos`).flush([{ idAuto: 8 }]);
    expect(component.guardandoAuto).toBe(false);
  });

  it('publica el viaje con fecha de Jujuy aunque UTC ya sea el dia siguiente', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-11-13T01:00:00Z'));
      component.idChofer = 3;
      component.autoAsignado = { idAuto: 8 } as any;
      component.recorridos = [{ idRecorrido: 1 }] as any;
      component.idRecorrido = 1;
      component.crearNuevoViaje();
      const req = TestBed.inject(HttpTestingController).expectOne(`${API_URL}/viajes`);
      expect(req.request.body.fechaSalida).toBe('2026-11-12');
      expect(req.request.body.horaSalida).toBe('22:00:00');
      req.flush({ msg: 'Prueba sin crear registros' }, { status: 409, statusText: 'Conflict' });
    } finally { vi.useRealTimers(); }
  });

  it('completa la asociacion si el backend anterior aun responde sin la confirmacion atomica', () => {
    component.autos = [];
    component.idChofer = 3;
    component.autoForm = { patente: 'AB123CD', marca: 'Fiat', modelo: 'Cronos', capacidadAsientos: 4, estado: 'DISPONIBLE' };
    component.guardarAuto();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne(`${API_URL}/autos`).flush({ auto: { idAuto: 8 } });
    const turno = http.expectOne(`${API_URL}/turnos`);
    expect(turno.request.body.idChofer).toBe(3);
    expect(turno.request.body.idAuto).toBe(8);
    expect(component.guardandoAuto).toBe(true);
    turno.flush({ status: '1' });
    http.expectOne(`${API_URL}/choferes/3/autos`).flush([{ idAuto: 8 }]);
    expect(component.guardandoAuto).toBe(false);
  });

});
