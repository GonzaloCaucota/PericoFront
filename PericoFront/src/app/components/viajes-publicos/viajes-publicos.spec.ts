import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { ViajesPublicos } from './viajes-publicos';
import { API_URL } from '../../config/api';

describe('Viajes como invitado', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [ViajesPublicos], providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])] }));
  it('consulta sin login, muestra asientos y ofrece ingresar para reservar', async () => {
    const fixture = TestBed.createComponent(ViajesPublicos);
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne(`${API_URL}/recorridos`).flush([]);
    const request = http.expectOne(`${API_URL}/viajes/publicos`);
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush([{ idViaje: 1, origen: 'Jujuy', destino: 'Perico', fechaSalida: '2099-11-10', horaSalida: '12:00', tarifaPorAsiento: '1500', asientosDisponibles: 3, salida: 'Dorrego', llegada: 'Centro', llegadaConfirmada: false }]);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('3 asientos disponibles');
    const asientos = fixture.nativeElement.querySelectorAll('.seat-chip');
    expect(Array.from(asientos).map((a: any) => a.textContent.trim())).toEqual(['1', '2', '3', '4']);
    expect(fixture.nativeElement.querySelectorAll('.seat-chip-busy').length).toBe(1);
    expect(fixture.nativeElement.textContent).toContain('Reservar sin cuenta');
    http.verify();
  });
  it('permite reintentar si falla la API', () => {
    const fixture = TestBed.createComponent(ViajesPublicos);
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne(`${API_URL}/recorridos`).flush([]);
    http.expectOne(`${API_URL}/viajes/publicos`).flush({}, { status: 503, statusText: 'Unavailable' });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No se pudieron cargar los viajes');
    fixture.nativeElement.querySelector('button').click();
    http.expectOne(`${API_URL}/viajes/publicos`).flush([]);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No hay viajes disponibles');
    http.verify();
  });
});

describe('Reserva sin cuenta', () => {
  beforeEach(() => { localStorage.removeItem('reserva-invitado-token'); TestBed.configureTestingModule({ imports: [ViajesPublicos], providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])] }); });
  afterEach(() => localStorage.removeItem('reserva-invitado-token'));
  it('envia nombre, telefono y asientos y conserva el comprobante', () => {
    const fixture = TestBed.createComponent(ViajesPublicos);
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne(`${API_URL}/recorridos`).flush([]);
    const viaje = { idViaje: 7, origen: 'Jujuy', destino: 'Perico', fechaSalida: '2099-11-10', horaSalida: '12:00', tarifaPorAsiento: '1500', asientosDisponibles: 3, salida: 'Dorrego', llegada: 'Centro', llegadaConfirmada: false, estadoViaje: 'ABIERTO', vehiculo: { marca: 'Test', modelo: 'Test' } };
    http.expectOne(`${API_URL}/viajes/publicos`).flush([viaje]);
    fixture.componentInstance.seleccionado = viaje;
    fixture.componentInstance.nombre = 'Ana Perez';
    fixture.componentInstance.telefono = '3881234567';
    fixture.componentInstance.asientos = 2;
    fixture.componentInstance.reservar();
    const request = http.expectOne(`${API_URL}/reservas/invitado`);
    expect(request.request.body).toEqual({ idViaje: 7, nombre: 'Ana Perez', telefono: '3881234567', cantidadAsientos: 2 });
    request.flush({ token: 'a'.repeat(64), reserva: { idReserva: 4, cantidadAsientos: 2, importeTotal: '3000', estadoReserva: 'PENDIENTE', estadoPago: 'PENDIENTE' } });
    http.expectOne(`${API_URL}/viajes/publicos`).flush([]);
    expect(localStorage.getItem('reserva-invitado-token')).toBe('a'.repeat(64));
    expect(fixture.componentInstance.comprobante?.idReserva).toBe(4);
    http.verify();
  });
});

describe('Ubicacion de invitado', () => {
  let geoDescriptor: PropertyDescriptor | undefined;
  beforeEach(() => {
    geoDescriptor = Object.getOwnPropertyDescriptor(navigator, 'geolocation');
    TestBed.configureTestingModule({ imports: [ViajesPublicos], providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])] });
  });
  afterEach(() => { if (geoDescriptor) Object.defineProperty(navigator, 'geolocation', geoDescriptor); else Reflect.deleteProperty(navigator, 'geolocation'); });
  it('envia coordenadas solo despues de obtener permiso y usa el comprobante', () => {
    const component = TestBed.createComponent(ViajesPublicos).componentInstance;
    component.tokenReserva = 'a'.repeat(64);
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition: (success: any) => success({ coords: { latitude: -24.2, longitude: -65.3, accuracy: 15 } }) } });
    component.compartirUbicacion();
    const http = TestBed.inject(HttpTestingController);
    const req = http.expectOne(`${API_URL}/reservas/invitado/ubicacion`);
    expect(req.request.headers.get('X-Reserva-Token')).toBe('a'.repeat(64));
    expect(req.request.body).toEqual({ compartir: true, latitud: -24.2, longitud: -65.3, precision: 15 });
    req.flush({ compartiendo: true });
    expect(component.mensajeUbicacion).toContain('Ubicacion compartida');
    expect(component.puntoPasajero).toMatchObject({ latitud: -24.2, longitud: -65.3 });
    component.retirarUbicacion();
    http.expectOne(`${API_URL}/reservas/invitado/ubicacion`).flush({ compartiendo: false, ubicacion: null });
    expect(component.puntoPasajero).toBeUndefined();
    http.verify();
  });
  for (const codigo of [2, 3]) {
    it(`reintenta sin alta precision cuando falla con codigo ${codigo}`, () => {
      const component = TestBed.createComponent(ViajesPublicos).componentInstance;
      component.tokenReserva = 'a'.repeat(64);
      const opciones: PositionOptions[] = [];
      Object.defineProperty(navigator, 'geolocation', { configurable: true, value: {
        getCurrentPosition: (success: any, failure: any, options: PositionOptions) => {
          opciones.push(options);
          if (options.enableHighAccuracy) failure({ code: codigo });
          else success({ coords: { latitude: -24.2, longitude: -65.3, accuracy: 500 } });
        }
      } });
      component.compartirUbicacion();
      expect(opciones.map(o => o.enableHighAccuracy)).toEqual([true, false]);
      const http = TestBed.inject(HttpTestingController);
      const req = http.expectOne(`${API_URL}/reservas/invitado/ubicacion`);
      expect(req.request.body.precision).toBe(500);
      req.flush({ compartiendo: true });
      expect(component.localizando).toBe(false);
      expect(component.mensajeUbicacion).toContain('Ubicacion compartida');
      http.verify();
    });
    it(`informa el fallo final con codigo ${codigo} sin enviar coordenadas`, () => {
      const component = TestBed.createComponent(ViajesPublicos).componentInstance;
      let intentos = 0;
      Object.defineProperty(navigator, 'geolocation', { configurable: true, value: {
        getCurrentPosition: (_: any, failure: any) => { intentos++; failure({ code: codigo }); }
      } });
      component.compartirUbicacion();
      expect(intentos).toBe(2);
      expect(component.localizando).toBe(false);
      expect(component.mensajeUbicacion).toContain(codigo === 3 ? 'tardo demasiado' : 'no pudo determinar');
      TestBed.inject(HttpTestingController).verify();
    });
  }
  it('respeta el permiso denegado sin enviar coordenadas', () => {
    const component = TestBed.createComponent(ViajesPublicos).componentInstance;
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition: (_: any, failure: any, options: PositionOptions) => { expect(options.enableHighAccuracy).toBe(true); failure({ code: 1 }); } } });
    component.compartirUbicacion();
    expect(component.mensajeUbicacion).toContain('No diste permiso');
    expect(component.localizando).toBe(false);
    TestBed.inject(HttpTestingController).verify();
  });
});

describe('Viaje finalizado sin cuenta', () => {
  beforeEach(() => {
    localStorage.removeItem('reserva-invitado-token');
    TestBed.configureTestingModule({ imports: [ViajesPublicos], providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])] });
  });
  afterEach(() => localStorage.removeItem('reserva-invitado-token'));
  it('muestra el viaje completado al consultar y retira acciones de una reserva activa', () => {
    const fixture = TestBed.createComponent(ViajesPublicos);
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne(`${API_URL}/recorridos`).flush([]);
    http.expectOne(`${API_URL}/viajes/publicos`).flush([]);
    fixture.componentInstance.tokenReserva = 'a'.repeat(64);
    fixture.componentInstance.consultarReserva();
    http.expectOne(`${API_URL}/reservas/invitado`).flush({ reserva: {
      idReserva: 5, estadoReserva: 'UTILIZADA', estadoPago: 'PAGADO', cantidadAsientos: 1, importeTotal: 1000
    } });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Viaje finalizado');
    expect(fixture.nativeElement.textContent).not.toContain('Cancelar mi reserva');
    expect(fixture.nativeElement.textContent).not.toContain('Compartir / actualizar mi ubicacion');
    http.verify();
  });
});
