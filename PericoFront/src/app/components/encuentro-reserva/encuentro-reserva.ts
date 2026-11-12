import { ChangeDetectorRef, Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { interval } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { API_URL } from '../../config/api';

@Component({
  selector: 'app-encuentro-reserva', standalone: true, imports: [CommonModule, FormsModule],
  template: `
    <section class="border rounded p-3 mt-2" *ngIf="reserva && activa">
      <h6>Horario de encuentro · Reserva #{{ reserva.idReserva }}</h6>
      <p class="small mb-2">El horario debe ser confirmado por el pasajero. La tolerancia es de {{ tolerancia }} minutos y se cuenta desde ese horario, no desde la salida del viaje.</p>
      <p *ngIf="reserva.horarioEncuentro" class="mb-2">
        <strong>{{ reserva.horarioEncuentro | date:'dd/MM/yyyy HH:mm':'GMT-3' }} (Jujuy)</strong>
        · {{ reserva.encuentroConfirmadoAt ? 'Confirmado por el pasajero' : 'Pendiente de confirmación del pasajero' }}
      </p>
      <ng-container *ngIf="modo === 'chofer'">
        <label [for]="'encuentro-' + reserva.idReserva" class="small">Proponer fecha y hora de encuentro (Jujuy)</label>
        <div class="d-flex flex-wrap gap-2 mb-2">
          <input type="datetime-local" [id]="'encuentro-' + reserva.idReserva" class="form-control w-auto" [(ngModel)]="propuesta" [disabled]="enviando">
          <button type="button" class="btn btn-sm btn-outline-primary" (click)="proponer()" [disabled]="enviando || !propuesta">Proponer horario</button>
        </div>
        <p class="small text-muted" *ngIf="!reserva.encuentroConfirmadoAt">Pedile al pasajero que consulte su reserva y confirme el horario. Si lo cambiás, deberá volver a confirmarlo.</p>
        <p class="small" *ngIf="reserva.encuentroConfirmadoAt">Podés registrar la ausencia a partir de las {{ limite | date:'dd/MM HH:mm':'GMT-3' }} (Jujuy), si el pasajero no llegó.</p>
        <button type="button" class="btn btn-sm btn-outline-danger" (click)="pedirAusencia = true" [disabled]="enviando || !puedeRegistrarAusencia">No se presentó · Liberar asientos</button>
        <p class="small text-muted mt-2" *ngIf="reserva.estadoPago !== 'PENDIENTE'">Esta reserva tiene un pago registrado. La debe resolver administración.</p>
        <div class="alert alert-warning mt-2 mb-0" *ngIf="pedirAusencia">
          <p>¿Confirmás que el pasajero no llegó después del horario acordado y los {{ tolerancia }} minutos de espera? Se liberarán {{ reserva.cantidadAsientos }} asiento(s) y quedará registrada su ausencia.</p>
          <button type="button" class="btn btn-danger btn-sm me-2" (click)="enviar('ausencia')" [disabled]="enviando || !puedeRegistrarAusencia">Confirmar ausencia</button>
          <button type="button" class="btn btn-outline-secondary btn-sm" (click)="pedirAusencia = false" [disabled]="enviando">Volver</button>
        </div>
      </ng-container>
      <ng-container *ngIf="modo !== 'chofer'">
        <p class="small" *ngIf="!reserva.horarioEncuentro">El chofer todavía no propuso un horario de encuentro.</p>
        <p class="small" *ngIf="reserva.horarioEncuentro && !reserva.encuentroConfirmadoAt">Confirmá solo si acordaste este horario con el chofer. Si no podés llegar, contactalo para coordinar otro.</p>
        <button type="button" class="btn btn-sm btn-primary" *ngIf="reserva.horarioEncuentro && !reserva.encuentroConfirmadoAt" (click)="enviar('confirmar')" [disabled]="enviando">Confirmar horario acordado</button>
      </ng-container>
      <p class="small mt-2 mb-0" role="status">{{ mensaje }}</p>
    </section>`
})
export class EncuentroReserva {
  @Input() reserva: any;
  @Input() modo: 'chofer' | 'pasajero' | 'invitado' = 'pasajero';
  @Input() token = '';
  @Output() cambio = new EventEmitter<any>();
  propuesta = '';
  enviando = false;
  pedirAusencia = false;
  mensaje = '';
  ahora = Date.now();
  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);
  constructor() {
    interval(15000).pipe(takeUntilDestroyed()).subscribe(() => { this.ahora = Date.now(); this.cdr.markForCheck(); });
  }
  get activa(): boolean { return ['PENDIENTE', 'CONFIRMADA'].includes(this.reserva?.estadoReserva); }
  get tolerancia(): number { return this.reserva?.toleranciaEncuentroMinutos ?? 10; }
  get limite(): number { return new Date(this.reserva?.horarioEncuentro).getTime() + this.tolerancia * 60000; }
  get puedeRegistrarAusencia(): boolean {
    return this.activa && !!this.reserva?.encuentroConfirmadoAt && this.reserva?.estadoPago === 'PENDIENTE' && this.ahora >= this.limite;
  }
  proponer(): void {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(this.propuesta)) return;
    const horario = new Date(this.propuesta + ':00-03:00');
    if (!Number.isFinite(horario.getTime())) { this.mensaje = 'Ingresá una fecha y hora válidas.'; return; }
    this.enviar('proponer', horario.toISOString());
  }
  enviar(accion: 'proponer' | 'confirmar' | 'ausencia', horario?: string): void {
    if (this.enviando || (accion === 'ausencia' && !this.puedeRegistrarAusencia)) return;
    const id = this.reserva.idReserva;
    const path = this.modo === 'invitado' ? '/reservas/invitado/encuentro/confirmar'
      : accion === 'ausencia' ? '/reservas/' + id + '/no-presentado'
      : '/reservas/' + id + '/encuentro' + (accion === 'confirmar' ? '/confirmar' : '');
    const options = this.modo === 'invitado' ? { headers: { 'X-Reserva-Token': this.token.trim() } } : {};
    this.enviando = true;
    this.mensaje = '';
    this.http.patch<any>(API_URL + path, { horarioEncuentro: horario ?? this.reserva.horarioEncuentro }, options).subscribe({
      next: data => {
        this.enviando = false;
        this.pedirAusencia = false;
        this.reserva = { ...this.reserva, ...data.reserva };
        this.mensaje = accion === 'ausencia' ? 'Ausencia registrada. Los asientos vuelven a estar disponibles.'
          : accion === 'confirmar' ? 'Horario confirmado.' : 'Propuesta enviada. Falta que el pasajero confirme.';
        this.cambio.emit(this.reserva);
        this.cdr.markForCheck();
      },
      error: err => { this.enviando = false; this.mensaje = err.error?.mensaje || 'No se pudo actualizar la reserva.'; this.cdr.markForCheck(); }
    });
  }
}
