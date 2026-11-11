import { Component, inject } from '@angular/core';
import { NotificacionesService } from '../../services/notificaciones.service';
@Component({
  selector: 'app-notificaciones', standalone: true,
  template: `<div class="toast-container position-fixed bottom-0 end-0 p-3" style="z-index:1090;max-width:100vw" aria-live="polite" aria-atomic="false">
    @for (aviso of servicio.avisos(); track aviso.id) {
      <div class="alert shadow d-flex gap-3 align-items-center mb-2" [class]="'alert alert-' + aviso.tipo" [attr.role]="aviso.tipo === 'danger' ? 'alert' : 'status'">
        <span>{{ aviso.mensaje }}</span>
        <button class="btn-close flex-shrink-0" type="button" aria-label="Cerrar notificacion" (click)="servicio.cerrar(aviso.id)"></button>
      </div>
    }
  </div>`
})
export class Notificaciones { readonly servicio = inject(NotificacionesService); }
