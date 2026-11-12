import { API_URL } from '../../config/api';
import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { LoginService } from '../../services/login-service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // Este interceptor corre antes de cada request HTTP.
  const loginService = inject(LoginService);
  
  // Obtenemos el token del sessionStorage
  const token = loginService.obtenerToken();

  // Si existe un token, clonamos la petición original y le pegamos el token con Bearer en el header Authorization
  if (token && req.url.startsWith(`${API_URL}/`)) {
    const peticionClonada = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
    return next(peticionClonada).pipe(catchError(error => {
      const publica = req.headers.has('X-Reserva-Token') || req.url.includes('/reservas/invitado')
        || req.url.includes('/usuarios/login') || req.url.includes('/viajes/publicos') || req.url.includes('/recorridos');
      if (error.status === 401 && !publica && loginService.obtenerToken() === token) loginService.sesionVencida();
      return throwError(() => error);
    }));
  }
  return next(req);
};
