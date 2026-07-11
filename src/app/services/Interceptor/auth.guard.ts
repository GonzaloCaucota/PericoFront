import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { LoginService } from '../../services/login-service';

export const authGuard: CanActivateFn = (route, state) => {
  const loginService = inject(LoginService);
  const router = inject(Router);
  
  // La sesion vive en LoginService y sessionStorage. Si no existe, vuelve al login.
  const usuario = loginService.usuarioSesionSignal();
  
  if (!usuario) {
    router.navigate(['/login']);
    return false;
  }
  const rolesPermitidos = route.data['roles'] as Array<string>;
  
  // Cada ruta puede declarar roles permitidos en app.routes.ts.
  if (rolesPermitidos && !rolesPermitidos.includes(usuario.rol)) {
    router.navigate(['/' + usuario.rol.toLowerCase() + '-dashboard']);
    return false;
  }

  return true;
};
