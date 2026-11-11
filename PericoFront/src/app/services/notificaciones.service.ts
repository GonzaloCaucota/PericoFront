import { Injectable, signal, OnDestroy } from '@angular/core';
export type TipoAviso = 'success' | 'danger' | 'info' | 'warning';
@Injectable({ providedIn: 'root' })
export class NotificacionesService implements OnDestroy {
  readonly avisos = signal<{ id: number; mensaje: string; tipo: TipoAviso }[]>([]);
  private siguiente = 0;
  private timers = new Map<number, ReturnType<typeof setTimeout>>();
  success(mensaje: string): void { this.mostrar(mensaje, 'success'); }
  error(mensaje: string): void { this.mostrar(mensaje, 'danger'); }
  info(mensaje: string): void { this.mostrar(mensaje, 'info'); }
  warning(mensaje: string): void { this.mostrar(mensaje, 'warning'); }
  cerrar(id: number): void {
    clearTimeout(this.timers.get(id)); this.timers.delete(id);
    this.avisos.update(avisos => avisos.filter(a => a.id !== id));
  }
  private mostrar(mensaje: string, tipo: TipoAviso): void {
    if (this.avisos().some(a => a.mensaje === mensaje && a.tipo === tipo)) return;
    if (this.avisos().length >= 5) this.cerrar(this.avisos()[0].id);
    const id = ++this.siguiente;
    this.avisos.update(avisos => [...avisos, { id, mensaje, tipo }]);
    this.timers.set(id, setTimeout(() => this.cerrar(id), 3500));
  }
  ngOnDestroy(): void { for (const timer of this.timers.values()) clearTimeout(timer); }
}
