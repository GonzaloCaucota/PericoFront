import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors, HttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { authInterceptor } from './auth.interceptor';
import { LoginService } from '../login-service';
import { API_URL } from '../../config/api';

describe('Sesion vencida en los paneles', () => {
 beforeEach(() => {
  sessionStorage.setItem('token', 'token-prueba');
  sessionStorage.setItem('usuarioSesion', JSON.stringify({ idUsuario: 7, rol: 'CHOFER' }));
  TestBed.configureTestingModule({ providers: [provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting(), provideRouter([{ path: '**', children: [] }])] });
 });
 afterEach(() => { sessionStorage.removeItem('token'); sessionStorage.removeItem('usuarioSesion'); });
 it('limpia una sesion no autorizada para evitar mostrar paneles vacios', () => {
  const service = TestBed.inject(LoginService);
  TestBed.inject(HttpClient).get(API_URL + '/choferes/3/autos').subscribe({ error: () => {} });
  TestBed.inject(HttpTestingController).expectOne(API_URL + '/choferes/3/autos').flush({}, { status: 401, statusText: 'Unauthorized' });
  expect(service.obtenerToken()).toBeNull();
  expect(service.usuarioSesionSignal()).toBeNull();
 });
 it('un comprobante de invitado invalido no cierra la sesion de la cuenta', () => {
  TestBed.inject(HttpClient).get(API_URL + '/reservas/invitado', { headers: { 'X-Reserva-Token': 'a'.repeat(64) } }).subscribe({ error: () => {} });
  TestBed.inject(HttpTestingController).expectOne(API_URL + '/reservas/invitado').flush({}, { status: 401, statusText: 'Unauthorized' });
  expect(TestBed.inject(LoginService).obtenerToken()).toBe('token-prueba');
 });
 it('un permiso denegado no borra una sesion valida', () => {
  TestBed.inject(HttpClient).get(API_URL + '/choferes').subscribe({ error: () => {} });
  TestBed.inject(HttpTestingController).expectOne(API_URL + '/choferes').flush({}, { status: 403, statusText: 'Forbidden' });
  expect(TestBed.inject(LoginService).obtenerToken()).toBe('token-prueba');
 });
});
