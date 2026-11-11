import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpClient, HttpParams } from '@angular/common/http';
import { API_URL } from '../../config/api';
import { RecorridoService } from '../../services/recorrido.service';
import { Recorrido } from '../../../models/recorrido.model';

export interface ViajePublico {
  idViaje: number; origen: string; destino: string; fechaSalida: string; horaSalida: string;
  tarifaPorAsiento: string; asientosDisponibles: number; salida: string; llegada: string;
  llegadaConfirmada: boolean; estadoViaje: string; vehiculo: { marca: string; modelo: string };
}

@Component({
  selector: 'app-viajes-publicos', standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <section class="container py-4" aria-labelledby="viajes-publicos-titulo">
      <h2 id="viajes-publicos-titulo">Viajes disponibles</h2>
      <p>Consulta y reserva sin registrarte. Solo necesitas tu nombre y telefono; el pago es en efectivo.</p>
      <div class="d-flex flex-wrap gap-2 mb-3">
        <label for="recorrido-publico" class="align-self-center">Recorrido</label>
        <select id="recorrido-publico" class="form-select w-auto" [(ngModel)]="idRecorrido" (ngModelChange)="buscar()" [disabled]="cargando">
          <option value="">Todos los recorridos</option>
          <option *ngFor="let r of recorridos" [value]="r.idRecorrido">{{ r.origen }} → {{ r.destino }}</option>
        </select>
        <button class="btn btn-outline-primary" (click)="buscar()" [disabled]="cargando">Actualizar viajes</button>
      </div>
      <p *ngIf="cargando" role="status">Buscando viajes…</p>
      <div *ngIf="error" class="alert alert-warning" role="alert">{{ error }}</div>
      <p *ngIf="!cargando && !error && !viajes.length">No hay viajes disponibles en este momento. Puedes volver a consultar más tarde.</p>
      <div *ngIf="mensajeReserva" class="alert alert-info" role="status">{{ mensajeReserva }}</div>
      <form *ngIf="seleccionado" class="card p-3 mb-4" (ngSubmit)="reservar()" #formReserva="ngForm">
        <h3 class="h5">Reservar: {{ seleccionado.origen }} → {{ seleccionado.destino }}</h3>
        <label for="invitado-nombre">Nombre y apellido</label>
        <input id="invitado-nombre" class="form-control mb-2" name="nombre" [(ngModel)]="nombre" required minlength="2" maxlength="100" autocomplete="name">
        <label for="invitado-telefono">Telefono de contacto</label>
        <input id="invitado-telefono" class="form-control mb-2" name="telefono" [(ngModel)]="telefono" required minlength="7" maxlength="20" type="tel" autocomplete="tel">
        <label for="invitado-asientos">Cantidad de asientos</label>
        <input id="invitado-asientos" class="form-control mb-2" name="asientos" [(ngModel)]="asientos" type="number" required min="1" [max]="seleccionado.asientosDisponibles" step="1">
        <p>Total: {{ (+seleccionado.tarifaPorAsiento) * asientos | currency:'ARS' }}. Pago en efectivo al chofer.</p>
        <p class="small">Usaremos tu nombre y telefono para gestionar esta reserva y compartirlos con el chofer y administracion.</p>
        <button class="btn btn-primary" type="submit" [disabled]="enviando || formReserva.invalid">{{ enviando ? 'Reservando…' : 'Confirmar reserva' }}</button>
        <button class="btn btn-link" type="button" (click)="seleccionado = undefined" [disabled]="enviando">Volver</button>
      </form>
      <div class="card p-3 mb-4">
        <h3 class="h5">Mi reserva sin cuenta</h3>
        <p class="small">Guarda el comprobante: permite consultar o cancelar tu reserva. No lo compartas.</p>
        <label for="comprobante-invitado">Comprobante</label>
        <input id="comprobante-invitado" class="form-control mb-2" [(ngModel)]="tokenReserva" maxlength="64" autocomplete="off">
        <button class="btn btn-outline-primary" (click)="consultarReserva()" [disabled]="enviando || !tokenReserva">Consultar reserva</button>
        <div *ngIf="tokenReserva" class="mt-3">
          <p class="small">Comparte tu ubicacion actual con el chofer para que pueda encontrarte. Es opcional y se envia solo cuando pulsas el boton.</p>
          <button class="btn btn-outline-success me-2" (click)="compartirUbicacion()" [disabled]="localizando">{{ localizando ? 'Obteniendo ubicacion…' : 'Compartir / actualizar mi ubicacion' }}</button>
          <button class="btn btn-outline-secondary" (click)="retirarUbicacion()" [disabled]="localizando">Dejar de compartir</button>
          <p class="small mt-2" role="status">{{ mensajeUbicacion }}</p>
        </div>
        <div *ngIf="comprobante" class="mt-3">
          <p>Reserva #{{ comprobante.idReserva }} · {{ comprobante.cantidadAsientos }} asiento(s) · {{ comprobante.importeTotal | currency:'ARS' }}</p>
          <p>Estado: {{ comprobante.estadoReserva }} · Pago: {{ comprobante.estadoPago }}</p>
          <button *ngIf="comprobante.estadoReserva === 'PENDIENTE' || comprobante.estadoReserva === 'CONFIRMADA'" class="btn btn-outline-danger" (click)="cancelarReserva()" [disabled]="enviando">Cancelar mi reserva</button>
        </div>
      </div>
      <div class="row g-3" aria-live="polite">
        <article class="col-md-6 col-xl-4" *ngFor="let v of viajes">
          <div class="card h-100 p-3">
            <h3 class="h5">{{ v.origen }} → {{ v.destino }}</h3>
            <p>{{ v.fechaSalida | date:'dd/MM/yyyy' }} · {{ v.horaSalida.slice(0,5) }} <span *ngIf="v.estadoViaje === 'EN_CURSO'" class="badge bg-success">En curso</span></p>
            <p class="mb-1"><strong>Salida:</strong> {{ v.salida }}</p>
            <p class="mb-1"><strong>Llegada:</strong> {{ v.llegada }}</p>
            <small *ngIf="!v.llegadaConfirmada" class="text-muted">Punto de llegada aproximado</small>
            <p class="mt-2">{{ v.asientosDisponibles }} asientos disponibles · {{ v.tarifaPorAsiento | currency:'ARS':'symbol':'1.0-2' }} por asiento</p>
            <button class="btn btn-primary mt-auto" (click)="seleccionado = v; mensajeReserva = ''">Reservar sin cuenta</button>
            <a routerLink="/pasajero" class="mt-2">Reservar con mi cuenta</a>
          </div>
        </article>
      </div>
    </section>`
})
export class ViajesPublicos implements OnInit {
  private http = inject(HttpClient);
  private catalogo = inject(RecorridoService);
  private cdr = inject(ChangeDetectorRef);
  recorridos: Recorrido[] = [];
  viajes: ViajePublico[] = [];
  idRecorrido = '';
  cargando = false;
  error = '';
  seleccionado?: ViajePublico;
  localizando = false;
  mensajeUbicacion = '';
  compartirUbicacion(): void {
    if (!navigator.geolocation) { this.mensajeUbicacion = 'Tu navegador no permite obtener ubicacion.'; return; }
    this.localizando = true;
    navigator.geolocation.getCurrentPosition(
      p => this.enviarUbicacion({ compartir: true, latitud: p.coords.latitude, longitud: p.coords.longitude, precision: p.coords.accuracy }),
      error => { this.localizando = false; this.mensajeUbicacion = error.code === 1 ? 'No diste permiso. Puedes continuar sin compartir ubicacion.' : 'No se pudo obtener tu ubicacion. Intenta nuevamente.'; this.cdr.markForCheck(); },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }
  retirarUbicacion(): void { this.localizando = true; this.enviarUbicacion({ compartir: false }); }
  private enviarUbicacion(body: object): void {
    this.http.patch<any>(`${API_URL}/reservas/invitado/ubicacion`, body, { headers: { 'X-Reserva-Token': this.tokenReserva.trim() } }).subscribe({
      next: data => { this.localizando = false; this.mensajeUbicacion = data.compartiendo ? 'Ubicacion compartida con el chofer. Actualizala si cambias de lugar.' : 'Tu ubicacion fue retirada.'; this.cdr.markForCheck(); },
      error: err => { this.localizando = false; this.mensajeUbicacion = err.error?.mensaje || 'No se pudo actualizar la ubicacion.'; this.cdr.markForCheck(); }
    });
  }
  nombre = '';
  telefono = '';
  asientos = 1;
  enviando = false;
  mensajeReserva = '';
  tokenReserva = localStorage.getItem('reserva-invitado-token') || '';
  comprobante?: { idReserva: number; cantidadAsientos: number; importeTotal: number; estadoReserva: string; estadoPago: string };
  reservar(): void {
    if (!this.seleccionado || this.enviando) return;
    this.enviando = true;
    this.http.post<any>(`${API_URL}/reservas/invitado`, { idViaje: this.seleccionado.idViaje, nombre: this.nombre, telefono: this.telefono, cantidadAsientos: this.asientos }).subscribe({
      next: data => {
        this.tokenReserva = data.token;
        localStorage.setItem('reserva-invitado-token', data.token);
        this.comprobante = data.reserva;
        this.seleccionado = undefined;
        this.nombre = ''; this.telefono = '';
        this.enviando = false;
        this.mensajeReserva = 'Reserva creada. Guarda tu comprobante para consultarla desde otro dispositivo.';
        this.buscar(); this.cdr.markForCheck();
      }, error: err => { this.enviando = false; this.mensajeReserva = err.error?.mensaje || 'No se pudo crear la reserva.'; this.cdr.markForCheck(); }
    });
  }
  consultarReserva(): void { this.gestionarReserva(false); }
  cancelarReserva(): void {
    if (window.confirm('¿Quieres cancelar tu reserva y liberar los asientos?')) this.gestionarReserva(true);
  }
  private gestionarReserva(cancelar: boolean): void {
    if (this.enviando) return;
    this.enviando = true;
    this.comprobante = undefined;
    const options = { headers: { 'X-Reserva-Token': this.tokenReserva.trim() } };
    const request = cancelar ? this.http.patch<any>(`${API_URL}/reservas/invitado/cancelar`, {}, options) : this.http.get<any>(`${API_URL}/reservas/invitado`, options);
    request.subscribe({
      next: data => { this.comprobante = data.reserva; this.enviando = false; this.mensajeReserva = cancelar ? 'Reserva cancelada.' : ''; localStorage.setItem('reserva-invitado-token', this.tokenReserva.trim()); if (cancelar) this.buscar(); this.cdr.markForCheck(); },
      error: err => { this.enviando = false; this.mensajeReserva = err.error?.mensaje || 'No se pudo consultar la reserva.'; this.cdr.markForCheck(); }
    });
  }
  ngOnInit(): void {
    this.catalogo.listar().subscribe({
      next: r => { this.recorridos = r; this.cdr.markForCheck(); },
      error: () => { this.cdr.markForCheck(); }
    });
    this.buscar();
  }
  buscar(): void {
    this.cargando = true;
    this.error = '';
    let params = new HttpParams();
    if (this.idRecorrido) params = params.set('idRecorrido', this.idRecorrido);
    this.http.get<ViajePublico[]>(`${API_URL}/viajes/publicos`, { params }).subscribe({
      next: viajes => { this.viajes = viajes; this.cargando = false; this.cdr.markForCheck(); },
      error: () => { this.viajes = []; this.cargando = false; this.error = 'No se pudieron cargar los viajes. Pulsa Actualizar viajes para reintentar.'; this.cdr.markForCheck(); }
    });
  }
}
