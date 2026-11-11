import { API_URL } from '../../config/api';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting, TestRequest } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { provideToastr } from 'ngx-toastr';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Home } from './home';

describe('Home', () => {
  let component: Home;
  let fixture: ComponentFixture<Home>;
  let catalogRequest: TestRequest;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([{ path: '**', children: [] }]), provideToastr()],
      imports: [Home]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Home);
    component = fixture.componentInstance;
    await fixture.whenStable();
    TestBed.inject(HttpTestingController).expectOne(`${API_URL}/viajes/publicos`).flush([]);
    const requests = TestBed.inject(HttpTestingController).match(`${API_URL}/recorridos`);
    requests.slice(1).forEach(request => request.flush([]));
    // Dejar pendiente el catalogo del Home para las pruebas siguientes.
    catalogRequest = requests[0];
  });

  it('muestra los dos recorridos con sus puntos de salida', () => {
    catalogRequest.flush([
      { idRecorrido: 1, codigo: 'SSJ_PERICO', origen: 'San Salvador de Jujuy', destino: 'Perico', paradaOrigen: { nombre: 'Dorrego y Jorge Newbery' }, paradaDestino: { nombre: 'Centro / acceso a la feria', ubicacionConfirmada: false } },
      { idRecorrido: 3, codigo: 'SSJ_EL_CARMEN', origen: 'San Salvador de Jujuy', destino: 'El Carmen', paradaOrigen: { nombre: 'Independencia y Lavalle' }, paradaDestino: { nombre: 'Centro de El Carmen', ubicacionConfirmada: false } },
      { idRecorrido: 2, codigo: 'PERICO_SSJ', origen: 'Perico', destino: 'San Salvador de Jujuy' }
    ]);
    fixture.detectChanges();
    const texto = fixture.nativeElement.textContent;
    expect(component.recorridos.length).toBe(2);
    expect(texto).toContain('Independencia y Lavalle');
    expect(texto).toContain('Dorrego y Jorge Newbery');
    expect(texto).toContain('Punto de llegada aproximado');
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
