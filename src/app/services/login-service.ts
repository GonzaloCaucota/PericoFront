import { Service, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import type { Admin } from '../../models/admin.model';
import type { ChoferModel } from '../../models/chofer.model';
import type { Pasajero } from '../../models/pasajero.model';
import type { Usuario } from '../../models/usuario.model';


export interface LoginPayload {
  email: string;
  password: string;
}

export type RolUsuario = Usuario['rol'];

export interface LoginResponse {
  status: 0 | 1;
  msg: string;
  rol?: RolUsuario;
  idUsuario?: number;
  idChofer?: number;
  idPasajero?: number;
  idAdmin?: number;
  nombre?: string;
  apellido?: string;
  email?: string;
  estadoChofer?: ChoferModel['estadoChofer'];
  estadoPasajero?: Pasajero['estadoPasajero'];
  estadoAdmin?: Admin['estadoAdmin'];
  token?: string;
  error?: string;
  usuario?: any;
}

export interface UsuarioSesion {
  idUsuario: number;
  idChofer?: number;
  idPasajero?: number;
  idAdmin?: number;
  rol: RolUsuario;
  nombre: string;
  apellido: string;
  email: string;
  telefono: string;
  estadoChofer?: ChoferModel['estadoChofer'];
  estadoPasajero?: Pasajero['estadoPasajero'];
  estadoAdmin?: Admin['estadoAdmin'];
  token: string;
}
@Service()
export class LoginService {
  private http = inject(HttpClient);
  private router = inject(Router);
  
  private apiUrl = 'http://localhost:3000/api/usuarios'; 

  private readonly TOKEN_KEY = 'token';
  private readonly USUARIO_KEY = 'usuarioSesion';

  public estaLogueadoSignal = signal<boolean>(!!sessionStorage.getItem('token'));
  // Signals permiten que header/guards reaccionen cuando cambia la sesion.
  public usuarioSesionSignal = signal<UsuarioSesion | null>(
    sessionStorage.getItem('usuarioSesion') ? JSON.parse(sessionStorage.getItem('usuarioSesion')!) : null
  );

  login(credenciales: LoginPayload): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/login`, credenciales);
  }

  loginConGoogle(idToken: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/login-google`, { token: idToken });
  }

  guardarSesion(datos: UsuarioSesion): void {
    // sessionStorage conserva la sesion mientras la pestana del navegador siga abierta.
    sessionStorage.setItem(this.TOKEN_KEY, datos.token);
    sessionStorage.setItem(this.USUARIO_KEY, JSON.stringify(datos));
    this.estaLogueadoSignal.set(true);
    this.usuarioSesionSignal.set(datos);
  }

  obtenerToken(): string | null {
    return sessionStorage.getItem(this.TOKEN_KEY);
  }

  obtenerUsuario(): UsuarioSesion | null {
    const usuario = sessionStorage.getItem(this.USUARIO_KEY);
    return usuario ? JSON.parse(usuario) : null;
  }

  estaLogueado(): boolean {
    return !!this.obtenerToken();
  }

  obtenerRol(): RolUsuario | null {
    const usuario = this.obtenerUsuario();
    return usuario ? usuario.rol : null;
  }

  cerrarSesion(): void {
    sessionStorage.removeItem(this.TOKEN_KEY);
    sessionStorage.removeItem(this.USUARIO_KEY);
    this.estaLogueadoSignal.set(false);
    this.usuarioSesionSignal.set(null);
    this.router.navigate(['/Home']);
  }
}
