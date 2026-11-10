import { Component,inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { LoginService } from '../../../services/login-service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-header',
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './header.html',
  styleUrl: './header.scss',
})
export class Header {
  public loginService = inject(LoginService);
  menuAbierto = false;       
  menuMovilAbierto = false;  

  get rutaDinamica(): string {
    const usuario = this.loginService.usuarioSesionSignal();
    
    if (!usuario) {
      return '/';
    }

    switch (usuario.rol) {
      case 'ADMIN': return '/admin';
      case 'CHOFER': return '/chofer';
      case 'PASAJERO': return '/pasajero';
      default: return '/';
    }
  }
  get textoInicio(): string {
    return this.loginService.estaLogueadoSignal() ? 'Mi Panel' : 'Inicio';
  }

  cerrarSesion(): void {
    this.loginService.cerrarSesion();
  }

  toggleMenu() {
    this.menuAbierto = !this.menuAbierto;
  }

  toggleMenuMovil() {
    this.menuMovilAbierto = !this.menuMovilAbierto;
  }

}
