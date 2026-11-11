import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { Notificaciones } from './notificaciones';
import { NotificacionesService } from '../../services/notificaciones.service';
describe('Notificaciones', () => {
  afterEach(() => vi.useRealTimers());
  it('muestra mensajes como texto y permite cerrarlos', () => {
    const fixture = TestBed.createComponent(Notificaciones);
    const servicio = TestBed.inject(NotificacionesService);
    servicio.error('<script>alert(1)</script>');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('<script>');
    expect(fixture.nativeElement.querySelector('script')).toBeNull();
    fixture.nativeElement.querySelector('button').click();
    fixture.detectChanges();
    expect(servicio.avisos()).toHaveLength(0);
  });
  it('evita duplicados y retira los avisos al vencer el tiempo', () => {
    vi.useFakeTimers();
    const servicio = TestBed.inject(NotificacionesService);
    servicio.success('Guardado'); servicio.success('Guardado');
    expect(servicio.avisos()).toHaveLength(1);
    vi.advanceTimersByTime(3500);
    expect(servicio.avisos()).toHaveLength(0);
  });
});
