import { EncuentroReserva } from '../encuentro-reserva/encuentro-reserva';
import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpClient, HttpParams } from '@angular/common/http';
import { API_URL } from '../../config/api';
import { RecorridoService } from '../../services/recorrido.service';
import { SocketService } from '../../services/socket.service';
import { MapaRutaComponent, PuntoMapa } from '../mapa-ruta/mapa-ruta';
import { Recorrido } from '../../../models/recorrido.model';

export interface ViajePublico {
  idViaje: number; origen: string; destino: string; fechaSalida: string; horaSalida: string;
  tarifaPorAsiento: string; asientosDisponibles: number; salida: string; llegada: string;
  llegadaConfirmada: boolean; estadoViaje: string; vehiculo: { marca: string; modelo: string; capacidadAsientos?: number };
}

@Component({
  selector: 'app-viajes-publicos', standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MapaRutaComponent, EncuentroReserva],
  styleUrl: './viajes-publicos.scss',
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
      <div *ngIf="mensajeReserva" class="alert" [class.alert-success]="sesionFinalizada" [class.alert-info]="!sesionFinalizada" role="status">{{ mensajeReserva }}</div>
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
        <div *ngIf="tokenReserva && !reservaTerminada" class="mt-3">
          <p class="small">Comparte tu ubicacion actual con el chofer para que pueda encontrarte. Es opcional y se envia solo cuando pulsas el boton.</p>
          <button class="btn btn-outline-success me-2" (click)="compartirUbicacion()" [disabled]="localizando">{{ localizando ? 'Obteniendo ubicacion…' : 'Compartir / actualizar mi ubicacion' }}</button>
          <button class="btn btn-outline-secondary" (click)="retirarUbicacion()" [disabled]="localizando">Dejar de compartir</button>
          <p class="small mt-2" role="status">{{ mensajeUbicacion }}</p>
          <app-mapa-ruta *ngIf="puntoPasajero" idMapa="mapaInvitado" [pasajero]="puntoPasajero" />
        </div>
        <div *ngIf="comprobante" class="mt-3">
          <div *ngIf="viajeFinalizado" class="alert alert-success" role="status" aria-live="polite">
            <h4 class="h5">Viaje finalizado</h4>
            <p class="mb-0">Tu viaje se completó. Gracias por viajar con nosotros. Ya podés reservar otro viaje.</p>
          </div>
          <app-encuentro-reserva *ngIf="!reservaTerminada" [reserva]="comprobante" modo="invitado" [token]="tokenReserva" (cambio)="consultarReserva()" />
          <p>Reserva #{{ comprobante.idReserva }} · {{ comprobante.cantidadAsientos }} asiento(s) · {{ comprobante.importeTotal | currency:'ARS' }}</p>
          <p>Estado: {{ comprobante.estadoReserva }} · Pago: {{ comprobante.estadoPago }}</p>
          <button *ngIf="comprobante.estadoReserva === 'PENDIENTE' || comprobante.estadoReserva === 'CONFIRMADA'" class="btn btn-outline-danger" (click)="pedirCancelacion = true" [disabled]="enviando">Cancelar mi reserva</button>
          <div *ngIf="pedirCancelacion" class="alert alert-warning mt-2">
            <p>¿Querés cancelar tu reserva y liberar los asientos?</p>
            <button type="button" class="btn btn-danger me-2" (click)="cancelarReserva()" [disabled]="enviando">Sí, cancelar reserva</button>
            <button type="button" class="btn btn-outline-secondary" (click)="pedirCancelacion = false" [disabled]="enviando">Volver</button>
          </div>
        </div>
      </div>
      <div class="row g-3" aria-live="polite">
        <article class="col-md-6 col-xl-4" *ngFor="let v of viajes">
          <div class="card trip-card h-100 p-3">
            <h3 class="h5">{{ v.origen }} → {{ v.destino }}</h3>
            <p>{{ v.fechaSalida | date:'dd/MM/yyyy' }} · {{ v.horaSalida.slice(0,5) }} <span *ngIf="v.estadoViaje === 'EN_CURSO'" class="badge bg-success">En curso</span></p>
            <p class="mb-1"><strong>Salida:</strong> {{ v.salida }}</p>
            <p class="mb-1"><strong>Llegada:</strong> {{ v.llegada }}</p>
            <small *ngIf="!v.llegadaConfirmada" class="text-muted">Punto de llegada aproximado</small>
            <p class="mt-2">{{ v.asientosDisponibles }} asientos disponibles · {{ v.tarifaPorAsiento | currency:'ARS':'symbol':'1.0-2' }} por asiento</p>
            <div class="seat-panel mb-3">
              <span>Asientos</span>
              <div class="seat-list" aria-label="Estado de los asientos">
                <span *ngFor="let asiento of getAsientos(v); let i = index" class="seat-chip"
                  [class.seat-chip-busy]="i < getAsientosOcupados(v)"
                  [attr.aria-label]="'Asiento ' + asiento + (i < getAsientosOcupados(v) ? ': ocupado' : ': disponible')">{{ asiento }}</span>
              </div>
            </div>
            <small class="text-muted mb-3">Azul: ocupado · Blanco: disponible</small>
            <button class="btn btn-primary mt-auto" (click)="seleccionado = v; mensajeReserva = ''">Reservar sin cuenta</button>
            <a routerLink="/pasajero" class="mt-2">Reservar con mi cuenta</a>
          </div>
        </article>
      </div>
    </section>`
})
export class ViajesPublicos implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private catalogo = inject(RecorridoService);
  private socket = inject(SocketService, { optional: true });
  private cdr = inject(ChangeDetectorRef);
  private actualizacionEstado?: ReturnType<typeof setInterval>;
  get viajeFinalizado(): boolean { return this.comprobante?.estadoReserva === 'UTILIZADA'; }
  get reservaTerminada(): boolean { return ['UTILIZADA', 'CANCELADA', 'NO_PRESENTADO'].includes(this.comprobante?.estadoReserva || ''); }
  private eventosEscuchados = new Set<string>();
  recorridos: Recorrido[] = [];
  viajes: ViajePublico[] = [];
  idRecorrido = '';
  cargando = false;
  error = '';
  seleccionado?: ViajePublico;
  puntoPasajero?: PuntoMapa;
  getAsientos(viaje: ViajePublico): number[] {
    return Array.from({ length: viaje.vehiculo?.capacidadAsientos || 4 }, (_, i) => i + 1);
  }
  getAsientosOcupados(viaje: ViajePublico): number {
    return Math.max(0, this.getAsientos(viaje).length - viaje.asientosDisponibles);
  }
  localizando = false;
  mensajeUbicacion = '';
  private actualizarVista(): void {
    this.cdr.markForCheck();
    this.cdr.detectChanges();
  }
  compartirUbicacion(): void {
    if (this.localizando) return;
    if (!navigator.geolocation) { this.mensajeUbicacion = 'Tu navegador no permite obtener ubicacion.'; this.actualizarVista(); return; }
    this.localizando = true;
    this.mensajeUbicacion = '';
    this.actualizarVista();
    this.obtenerUbicacion(true);
  }
  private obtenerUbicacion(altaPrecision: boolean, token = this.tokenReserva): void {
    navigator.geolocation.getCurrentPosition(
      p => { if (token !== this.tokenReserva) return; this.enviarUbicacion({ compartir: true, latitud: p.coords.latitude, longitud: p.coords.longitude, precision: p.coords.accuracy }); },
      error => {
        if (token !== this.tokenReserva) return;
        // Si no consigue una posicion precisa, permitir que el navegador use otra fuente.
        if (altaPrecision && (error.code === 2 || error.code === 3)) {
          this.mensajeUbicacion = 'Buscando una ubicacion aproximada…';
          this.actualizarVista();
          this.obtenerUbicacion(false, token);
          return;
        }
        this.localizando = false;
        this.mensajeUbicacion = error.code === 1
          ? 'No diste permiso. Habilita la ubicacion para este sitio en tu navegador y vuelve a intentar.'
          : error.code === 3
            ? 'La busqueda de ubicacion tardo demasiado. Verifica que la ubicacion del dispositivo este activada y vuelve a intentar.'
            : 'Tu dispositivo no pudo determinar la ubicacion. Activa la ubicacion del dispositivo, verifica tu conexion y vuelve a intentar.';
        this.actualizarVista();
      },
      { enableHighAccuracy: altaPrecision, timeout: altaPrecision ? 10000 : 20000, maximumAge: altaPrecision ? 0 : 300000 }
    );
  }
  retirarUbicacion(): void { this.localizando = true; this.actualizarVista(); this.enviarUbicacion({ compartir: false }); }
  private enviarUbicacion(body: { compartir: boolean; latitud?: number; longitud?: number; precision?: number }): void {
    const token = this.tokenReserva;
    this.http.patch<any>(`${API_URL}/reservas/invitado/ubicacion`, body, { headers: { 'X-Reserva-Token': this.tokenReserva.trim() } }).subscribe({
      next: data => {
        if (token !== this.tokenReserva) return;
        this.puntoPasajero = data.compartiendo ? {
          latitud: Number(data.ubicacion?.latitud ?? body.latitud),
          longitud: Number(data.ubicacion?.longitud ?? body.longitud),
          etiqueta: 'Tu ubicacion', tipo: 'pasajero'
        } : undefined;
        this.localizando = false; this.mensajeUbicacion = data.compartiendo ? 'Ubicacion compartida con el chofer. Actualizala si cambias de lugar.' : 'Tu ubicacion fue retirada.'; this.actualizarVista(); },
      error: err => { if (token !== this.tokenReserva) return; this.localizando = false; this.mensajeUbicacion = err.error?.mensaje || 'No se pudo actualizar la ubicacion.'; this.actualizarVista(); }
    });
  }
  nombre = '';
  telefono = '';
  asientos = 1;
  enviando = false;
  mensajeReserva = '';
  sesionFinalizada = false;
  pedirCancelacion = false;
  private eventoReserva?: string;
  private eventoCancelacion?: string;
  tokenReserva = localStorage.getItem('reserva-invitado-token') || '';
  comprobante?: { idReserva: number; cantidadAsientos: number; importeTotal: number; estadoReserva: string; estadoPago: string };
  reservar(): void {
    if (!this.seleccionado || this.enviando) return;
    if (this.tokenReserva) {
      this.mensajeReserva = 'Primero consultá tu reserva actual y cancelala si querés pedir otro viaje.';
      this.actualizarVista();
      return;
    }
    this.sesionFinalizada = false;
    this.enviando = true;
    this.http.post<any>(`${API_URL}/reservas/invitado`, { idViaje: this.seleccionado.idViaje, nombre: this.nombre, telefono: this.telefono, cantidadAsientos: this.asientos }).subscribe({
      next: data => {
        this.tokenReserva = data.token;
        localStorage.setItem('reserva-invitado-token', data.token);
        this.comprobante = data.reserva;
        this.registrarEventosReserva();
        this.seleccionado = undefined;
        this.nombre = ''; this.telefono = '';
        this.enviando = false;
        this.mensajeReserva = 'Reserva creada. Guarda tu comprobante para consultarla desde otro dispositivo.';
        this.buscar(); this.actualizarVista();
      }, error: err => { this.enviando = false; this.mensajeReserva = err.error?.mensaje || 'No se pudo crear la reserva.'; this.actualizarVista(); }
    });
  }
  consultarReserva(): void { this.gestionarReserva(false); }
  cancelarReserva(): void {
    this.gestionarReserva(true);
  }
  private gestionarReserva(cancelar: boolean): void {
    if (this.enviando || !this.tokenReserva.trim()) return;
    this.enviando = true;

    const options = { headers: { 'X-Reserva-Token': this.tokenReserva.trim() } };
    const request = cancelar ? this.http.patch<any>(`${API_URL}/reservas/invitado/cancelar`, {}, options) : this.http.get<any>(`${API_URL}/reservas/invitado`, options);
    request.subscribe({
      next: data => {
        this.comprobante = data.reserva;
        if (this.reservaTerminada) {
          const mensaje = this.viajeFinalizado ? 'Viaje finalizado. Gracias por viajar con nosotros. Ya podés pedir un nuevo viaje.'
            : this.comprobante?.estadoReserva === 'NO_PRESENTADO' ? 'La reserva terminó por ausencia. Ya podés pedir un nuevo viaje.'
            : 'Reserva cancelada. Los asientos fueron liberados. Ya podés pedir un nuevo viaje.';
          this.reiniciarSesionInvitado(mensaje);
          return;
        }
        this.registrarEventosReserva();
        if (cancelar || this.reservaTerminada) {
          this.puntoPasajero = undefined;
        } else if (data.ubicacion?.latitud != null && data.ubicacion?.longitud != null) {
          this.puntoPasajero = { latitud: Number(data.ubicacion.latitud), longitud: Number(data.ubicacion.longitud), etiqueta: 'Tu ubicacion', tipo: 'pasajero' };
        }
        this.enviando = false;
        if (cancelar) this.mensajeReserva = 'Reserva cancelada.';
        localStorage.setItem('reserva-invitado-token', this.tokenReserva.trim());
        if (cancelar) this.buscar();
        this.actualizarVista();
      },
      error: err => { this.enviando = false; this.mensajeReserva = err.error?.mensaje || 'No se pudo consultar la reserva.'; this.actualizarVista(); }
    });
  }
  private retirarEventosReserva(): void {
    for (const evento of [this.eventoReserva, this.eventoCancelacion]) {
      if (evento) { this.socket?.dejarDeEscuchar(evento); this.eventosEscuchados.delete(evento); }
    }
    this.eventoReserva = undefined;
    this.eventoCancelacion = undefined;
  }
  private reiniciarSesionInvitado(mensaje: string): void {
    this.retirarEventosReserva();
    localStorage.removeItem('reserva-invitado-token');
    this.tokenReserva = '';
    this.comprobante = undefined;
    this.seleccionado = undefined;
    this.nombre = ''; this.telefono = ''; this.asientos = 1;
    this.puntoPasajero = undefined;
    this.mensajeUbicacion = '';
    this.pedirCancelacion = false;
    this.enviando = false;
    this.localizando = false;
    this.sesionFinalizada = true;
    this.mensajeReserva = mensaje;
    this.buscar();
    this.actualizarVista();
  }
  private registrarEventosReserva(): void {
    if (!this.comprobante) return;
    this.retirarEventosReserva();
    this.eventoReserva = `reserva_actualizada_${this.comprobante.idReserva}`;
    this.eventoCancelacion = `reserva_cancelada_${this.comprobante.idReserva}`;
    this.escucharSocket(this.eventoReserva, () => this.consultarReserva());
    this.escucharSocket(this.eventoCancelacion, () => this.consultarReserva());
  }
  ngOnInit(): void {
    if (this.tokenReserva) this.consultarReserva();
    this.actualizacionEstado = setInterval(() => {
      if (this.tokenReserva && !this.reservaTerminada) this.consultarReserva();
    }, 15000);
    this.escucharSocket('viaje_creado', () => this.buscar());
    this.catalogo.listar().subscribe({
      next: r => { this.recorridos = r; this.actualizarVista(); },
      error: () => { this.actualizarVista(); }
    });
    this.buscar();
  }
  ngOnDestroy(): void {
    clearInterval(this.actualizacionEstado);
    this.eventosEscuchados.forEach(evento => this.socket?.dejarDeEscuchar(evento));
    this.eventosEscuchados.clear();
  }
  private escucharSocket<T>(evento: string, callback: (data: T) => void): void {
    if (!this.socket) return;
    this.eventosEscuchados.add(evento);
    this.socket.escuchar<T>(evento, callback);
  }
  private registrarEventosViajes(): void {
    this.viajes.forEach(v => {
      this.escucharSocket<any>(`asientos_actualizados_viaje_${v.idViaje}`, data => {
        const encontrado = this.viajes.find(item => Number(item.idViaje) === Number(data?.idViaje));
        if (encontrado && data?.asientosDisponibles != null) {
          encontrado.asientosDisponibles = Number(data.asientosDisponibles);
          this.actualizarVista();
        }
      });
      this.escucharSocket<any>(`viaje_actualizado_${v.idViaje}`, data => {
        const encontrado = this.viajes.find(item => Number(item.idViaje) === Number(data?.idViaje));
        if (encontrado && data?.estadoViaje) {
          encontrado.estadoViaje = data.estadoViaje;
        }
        if (data?.estadoViaje && data.estadoViaje !== 'ABIERTO' && data.estadoViaje !== 'EN_CURSO') {
          this.viajes = this.viajes.filter(item => Number(item.idViaje) !== Number(data?.idViaje));
        }
        this.actualizarVista();
      });
    });
  }
  buscar(): void {
    this.cargando = true;
    this.error = '';
    let params = new HttpParams();
    if (this.idRecorrido) params = params.set('idRecorrido', this.idRecorrido);
    this.http.get<ViajePublico[]>(`${API_URL}/viajes/publicos`, { params }).subscribe({
      next: viajes => { this.viajes = viajes; this.cargando = false; this.registrarEventosViajes(); this.actualizarVista(); },
      error: () => { this.viajes = []; this.cargando = false; this.error = 'No se pudieron cargar los viajes. Pulsa Actualizar viajes para reintentar.'; this.actualizarVista(); }
    });
  }
}
