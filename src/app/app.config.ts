import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideToastr } from 'ngx-toastr';
import { routes } from './app.routes';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { authInterceptor } from './services/Interceptor/auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // Router conecta las URLs del navegador con componentes standalone.
    provideRouter(routes),
    // Animaciones necesarias para Toastr y componentes visuales.
    provideAnimations(),
    // HttpClient se usa en los services para consumir la API Express.
    provideHttpClient(),
    // Toastr muestra notificaciones no bloqueantes al usuario.
    provideToastr({
      timeOut: 3500,
      positionClass: 'toast-bottom-right',
      preventDuplicates: true,
      progressBar: true,
      progressAnimation: 'increasing',
      closeButton: true
    }),
    provideHttpClient(),
    // ng2-charts se usa para graficos del panel admin/dashboard.
    provideCharts(withDefaultRegisterables()),
    // Interceptor agrega el JWT automaticamente a cada request HTTP.
    provideHttpClient(withInterceptors([authInterceptor]))
  ]
};
