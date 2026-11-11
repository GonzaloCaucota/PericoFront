import { API_URL } from '../../config/api';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminPage } from './admin';

describe('AdminPage', () => {
  let component: AdminPage;
  let fixture: ComponentFixture<AdminPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([{ path: '**', children: [] }])],
      imports: [AdminPage],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminPage);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('permite al administrador solicitar el alta de un chofer desde el panel', () => {
    component.altaForm.setValue({ tipo: 'CHOFER', nombre: 'Nuevo', apellido: 'Chofer', email: 'chofer@example.test', telefono: '3880000000', passwordHash: 'ClaveDePrueba123', licenciaConducir: 'LIC-TEST', fechaHabilitacion: '2026-01-01' });
    component.darAlta();
    const request = TestBed.inject(HttpTestingController).expectOne(`${API_URL}/admins/choferes`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body.licenciaConducir).toBe('LIC-TEST');
    request.flush({ mensaje: 'Chofer dado de alta y aprobado.' });
    expect(component.mensajeModeracion).toContain('aprobado');
  });

  it('muestra la aprobacion pendiente y exige un motivo para bloquear', () => {
    const item = { idChofer: 10, usuario: { idUsuario: 20, nombre: 'Pendiente', activo: false }, estadoChofer: 'INACTIVO', habilitacion: { estado: 'PENDIENTE' } };
    const boton = Array.from(fixture.nativeElement.querySelectorAll('button')).find((element: any) => element.textContent.includes('Gestionar Choferes')) as HTMLButtonElement;
    boton.click();
    TestBed.inject(HttpTestingController).expectOne(`${API_URL}/choferes`).flush([item]);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Aprobar alta');
    expect(fixture.nativeElement.textContent).toContain('PENDIENTE DE ALTA');
    component.moderar(item, 'bloquear');
    expect(component.errorModeracion).toContain('motivo');
    TestBed.inject(HttpTestingController).expectNone(`${API_URL}/admins/choferes/10/bloquear`);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
