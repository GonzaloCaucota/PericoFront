import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';

import { GestionUsuariosService } from './gestion-usuarios.service';

describe('GestionUsuariosService', () => {
  let service: GestionUsuariosService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([{ path: '**', children: [] }])],});
    service = TestBed.inject(GestionUsuariosService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
