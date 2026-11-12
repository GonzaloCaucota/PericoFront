import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { EncuentroReserva } from './encuentro-reserva';
import { API_URL } from '../../config/api';

describe('Encuentro por reserva', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [EncuentroReserva], providers: [provideHttpClient(), provideHttpClientTesting()] }));
  it('respeta los 10 minutos desde el horario confirmado', () => {
    const component = TestBed.createComponent(EncuentroReserva).componentInstance;
    component.reserva = { idReserva: 4, estadoReserva: 'CONFIRMADA', estadoPago: 'PENDIENTE', horarioEncuentro: '2026-11-12T19:00:00Z', encuentroConfirmadoAt: '2026-11-12T18:00:00Z', encuentroAceptadoPor: 7, toleranciaEncuentroMinutos: 10 };
    component.ahora = Date.parse('2026-11-12T19:09:59Z');
    expect(component.puedeRegistrarAusencia).toBe(false);
    component.ahora = Date.parse('2026-11-12T19:10:00Z');
    expect(component.puedeRegistrarAusencia).toBe(true);
    component.reserva.encuentroConfirmadoAt = null;
    expect(component.puedeRegistrarAusencia).toBe(false);
  });
  it('el invitado propone el horario usando su comprobante', () => {
    const component = TestBed.createComponent(EncuentroReserva).componentInstance;
    component.modo = 'invitado';
    component.token = 'a'.repeat(64);
    component.reserva = { idReserva: 4, horarioEncuentro: '2026-11-12T19:00:00Z' };
    component.enviar('proponer', component.reserva.horarioEncuentro);
    const http = TestBed.inject(HttpTestingController);
    const req = http.expectOne(API_URL + '/reservas/invitado/encuentro');
    expect(req.request.headers.get('X-Reserva-Token')).toBe('a'.repeat(64));
    expect(req.request.body.horarioEncuentro).toBe(component.reserva.horarioEncuentro);
    req.flush({ reserva: { encuentroConfirmadoAt: null } });
    expect(component.enviando).toBe(false);
    http.verify();
  });
  it('convierte la propuesta de Jujuy a una fecha con zona horaria y no duplica el envio', () => {
    const component = TestBed.createComponent(EncuentroReserva).componentInstance;
    component.modo = 'pasajero';
    component.reserva = { idReserva: 4 };
    component.propuesta = '2026-11-12T16:30';
    component.proponer();
    component.proponer();
    const http = TestBed.inject(HttpTestingController);
    const req = http.expectOne(API_URL + '/reservas/4/encuentro');
    expect(req.request.body.horarioEncuentro).toBe('2026-11-12T19:30:00.000Z');
    req.flush({ reserva: {} });
    http.verify();
  });
  it('solo el chofer puede aceptar la propuesta', () => {
    const component = TestBed.createComponent(EncuentroReserva).componentInstance;
    component.reserva = { idReserva: 4, horarioEncuentro: '2026-11-12T19:00:00Z' };
    const http = TestBed.inject(HttpTestingController);
    component.modo = 'pasajero';
    component.enviar('confirmar');
    http.expectNone(API_URL + '/reservas/4/encuentro/confirmar');
    component.modo = 'chofer';
    component.enviar('confirmar');
    http.expectOne(API_URL + '/reservas/4/encuentro/confirmar').flush({ reserva: { encuentroConfirmadoAt: '2026-11-12T18:00:00Z', encuentroAceptadoPor: 7 } });
    component.enviar('proponer', '2026-11-12T20:00:00Z');
    http.verify();
  });

});
