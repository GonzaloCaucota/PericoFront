import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { provideToastr } from 'ngx-toastr';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RegistrarUsuario } from './registrar-usuario';

describe('RegistrarUsuario', () => {
  let component: RegistrarUsuario;
  let fixture: ComponentFixture<RegistrarUsuario>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([{ path: '**', children: [] }]), provideToastr()],
      imports: [RegistrarUsuario],
    }).compileComponents();

    fixture = TestBed.createComponent(RegistrarUsuario);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
