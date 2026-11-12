import { EncuentroReserva } from '../../components/encuentro-reserva/encuentro-reserva';
import { RecorridoService } from '../../services/recorrido.service';
import { Recorrido } from '../../../models/recorrido.model';
import { Component, ChangeDetectorRef, OnInit, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PasajeroService, CrearReservaDto } from '../../services/pasajero.service';
import { RutaService } from '../../services/ruta.service';
import { GeolocationService } from '../../services/geolocalizacion.service';
import { Pasajero } from '../../../models/pasajero.model';
import { Viaje } from '../../../models/viaje.model';
import { Reserva } from '../../../models/reserva.model';
import { MapaRutaComponent, PuntoMapa } from '../../components/mapa-ruta/mapa-ruta';
import { SocketService } from '../../services/socket.service';
import { NotificacionesService } from '../../services/notificaciones.service';
import * as bootstrap from 'bootstrap';

type ViajeCard = Viaje & {
  idChofer?: number;
  idAuto?: number;
  chofer?: any;
  auto?: any;
  reservas?: any[];
};

type ReservaHistorial = Reserva & {
  viaje?: ViajeCard;
};

@Component({
  selector: 'app-pasajero',
  standalone: true,
  imports: [CommonModule, FormsModule, MapaRutaComponent, EncuentroReserva],
  templateUrl: './pasajero.html',
  styleUrl: './pasajero.scss'
})
export class PasajeroComponent implements OnInit, AfterViewInit, OnDestroy {
  // Pantalla principal del pasajero: busca viajes, reserva, cancela y ve ubicacion/ruta.
  public pasajero?: Pasajero;
  public viajesDisponibles: ViajeCard[] = [];
  public historial: ReservaHistorial[] = [];
  public reservaActiva?: ReservaHistorial;

  public recorridos: Recorrido[] = [];
  public idRecorrido: number | null = null;
  public cantidadAsientos = 1;

  public mostrarHistorial = false;
  public buscando = false;
  public mensaje = '';
  public cancelandoReserva = false;
  public enviandoUbicacion = false;

  public puntoChofer?: PuntoMapa;
  public puntoPasajero?: PuntoMapa;
  public rutaGeoJson?: GeoJSON.LineString;

  private eventosEscuchados = new Set<string>();
  private modalCancelarReserva?: bootstrap.Modal;

  public idPasajero =
    Number(sessionStorage.getItem('idPasajero')) ||
    this.getIdPasajeroSesion() ||
    1;

  constructor(
    private _recorridoService: RecorridoService,
    private _pasajeroService: PasajeroService,
    private _rutaService: RutaService,
    private _geolocationService: GeolocationService,
    private _changeDetectorRef: ChangeDetectorRef,
    private _socketService: SocketService,
    private _toastr: NotificacionesService
  ) {}

  ngOnInit(): void {
    this.loadPasajero();
    this.escucharEvento<any>('viaje_creado', () => {
      this.buscarViajes(true);
    });
    this._recorridoService.listar().subscribe({
      next: recorridos => {
        this.recorridos = recorridos;
        this.idRecorrido = recorridos.find(r => r.codigo === 'SSJ_PERICO')?.idRecorrido ?? recorridos[0]?.idRecorrido ?? null;
        this.buscarViajes();
        this._changeDetectorRef.detectChanges();
      },
      error: () => { this.mensaje = 'No se pudieron cargar los recorridos. Recarga la pagina para reintentar.'; this._changeDetectorRef.detectChanges(); }
    });
  }

  ngOnDestroy(): void {
    this.eventosEscuchados.forEach(evento => this._socketService.dejarDeEscuchar(evento));
    this.eventosEscuchados.clear();
  }

  get recorridoSeleccionado(): Recorrido | undefined {
    return this.recorridos.find(recorrido => recorrido.idRecorrido === Number(this.idRecorrido));
  }

  ngAfterViewInit(): void {
    const modal = document.getElementById('modalCancelarReserva');

    if (modal) {
      this.modalCancelarReserva = new bootstrap.Modal(modal);
    }
  }

  loadPasajero(): void {
    this._pasajeroService.getPasajeroById(this.idPasajero).subscribe({
      next: (data: any) => {
        this.pasajero = data;

        // La reserva activa es la que todavia no termino ni fue cancelada.
        this.reservaActiva = data.reservas?.find((reserva: ReservaHistorial) =>
          (
            reserva.estadoReserva === 'PENDIENTE' ||
            reserva.estadoReserva === 'CONFIRMADA'
          ) &&
          reserva.viaje?.estadoViaje !== 'CANCELADO' &&
          reserva.viaje?.estadoViaje !== 'FINALIZADO'
        );

        this.registrarEventosDeReservaActiva();
        this.sincronizarPuntoChoferDesdeReserva();
        this._changeDetectorRef.detectChanges();
      },
      error: (err) => console.error('Error al cargar pasajero:', err)
    });
  }

  buscarViajes(silencioso = false): void {
    if (!this.recorridoSeleccionado) {
      this.mensaje = 'Selecciona un recorrido disponible.';
      return;
    }

    if (!silencioso) {
      this.buscando = true;
      this.mensaje = '';
    }

    // El service llama a /api/viajes/disponibles y el backend filtra por recorrido/asientos.
    this._pasajeroService.getViajesDisponibles(Number(this.idRecorrido)).subscribe({
      next: (data) => {
        this.viajesDisponibles = data as ViajeCard[];
        this.registrarEventosDeViajesDisponibles();
        this.buscando = false;
        this._changeDetectorRef.detectChanges();
      },
      error: (err) => {
        this.buscando = false;

        if (!silencioso) {
          this.mensaje = 'No se pudieron cargar los viajes disponibles.';
        }

        console.error('Error al buscar viajes:', err);
      }
    });
  }

  getImporteTotal(viaje: ViajeCard): number {
    return Number(viaje.tarifaPorAsiento) * this.cantidadAsientos;
  }

  reservarConEfectivo(viaje: ViajeCard): void {
    this.crearReserva(viaje);
  }

  private crearReserva(viaje: ViajeCard): void {
    if (this.reservaActiva) {
      this.mensaje = 'Ya tenes una reserva activa. Cancelala o finalizala antes de reservar otro viaje.';
      return;
    }

    if (this.cantidadAsientos > viaje.asientosDisponibles) {
      this.mensaje = 'No hay suficientes asientos disponibles.';
      return;
    }

    // Esta estructura coincide con el modelo Reserva del backend.
    const reserva: CrearReservaDto = {
      idPasajero: this.idPasajero,
      idViaje: viaje.idViaje,
      cantidadAsientos: this.cantidadAsientos,
      importeTotal: Number(viaje.tarifaPorAsiento) * this.cantidadAsientos,
      estadoReserva: 'CONFIRMADA',
      estadoPago: 'PENDIENTE'
    };

    this._pasajeroService.crearReserva(reserva).subscribe({
      next: (response) => {
        this.loadPasajero();
        this.buscarViajes();

        if (response?.reserva?.idViaje) {
          this.actualizarAsientosEnListado(response.reserva.idViaje, response.asientosDisponibles);
        }

        this.mensaje = 'Reserva creada. El pago queda pendiente en efectivo.';
        this._changeDetectorRef.detectChanges();
      },
      error: (err) => {
        this.mensaje = 'No se pudo crear la reserva.';
        console.error(err);
        this._changeDetectorRef.detectChanges();
      }
    });
  }

  verHistorial(): void {
    this.mostrarHistorial = !this.mostrarHistorial;

    if (!this.mostrarHistorial) return;

    this._pasajeroService.getHistorialPasajero(this.idPasajero).subscribe({
      next: (data) => {
        this.historial = data as ReservaHistorial[];
        this._changeDetectorRef.detectChanges();
      },
      error: (err) => console.error('Error al cargar historial:', err)
    });
  }

  volverAViajesDisponibles(): void {
    this.mostrarHistorial = false;
    this.buscarViajes();
  }

  abrirModalCancelarReserva(): void {
    if (!this.reservaActiva) return;

    this.modalCancelarReserva?.show();
  }

  confirmarCancelacionReserva(): void {
    this.cancelarReservaActiva();
  }

  cancelarReservaActiva(): void {
    if (!this.reservaActiva) return;

    this.cancelandoReserva = true;

    this._pasajeroService.cancelarReserva(this.reservaActiva.idReserva).subscribe({
      next: (response) => {
        this.modalCancelarReserva?.hide();
        this._toastr.warning('Reserva cancelada correctamente.');

        if (response?.viaje?.idViaje) {
          this.actualizarAsientosEnListado(
            response.viaje.idViaje,
            response.viaje.asientosDisponibles
          );
        }

        this.reservaActiva = undefined;
        this.puntoChofer = undefined;
        this.puntoPasajero = undefined;
        this.rutaGeoJson = undefined;

        this.cancelandoReserva = false;
        this.loadPasajero();
        this.buscarViajes(true);
        this._changeDetectorRef.detectChanges();
      },
      error: (err) => {
        this.cancelandoReserva = false;
        this._toastr.error(err.error?.mensaje || 'No se pudo cancelar la reserva.');
        console.error('Error al cancelar reserva:', err);
        this._changeDetectorRef.detectChanges();
      }
    });
  }
  abrirConfiguracion(): void {
    this.mensaje = 'Configuracion pendiente de implementar.';
  }

  actualizarUbicacionChofer(): void {
    const idChofer = this.reservaActiva?.viaje?.idChofer || this.reservaActiva?.viaje?.chofer?.idChofer;

    if (!idChofer) {
      this.mensaje = 'No se encontro el chofer de la reserva activa.';
      this._changeDetectorRef.detectChanges();
      return;
    }

    this._pasajeroService.getChoferById(idChofer).subscribe({
      next: (chofer: any) => {
        if (chofer.latitud === null || chofer.latitud === undefined || chofer.longitud === null || chofer.longitud === undefined) {
          this.mensaje = 'El chofer todavia no compartio su ubicacion.';
          this._changeDetectorRef.detectChanges();
          return;
        }

        this.puntoChofer = {
          latitud: Number(chofer.latitud),
          longitud: Number(chofer.longitud),
          etiqueta: 'Chofer',
          tipo: 'chofer'
        };

        this._changeDetectorRef.detectChanges();
      },
      error: (err) => {
        this.mensaje = 'No se pudo actualizar la ubicacion del chofer.';
        console.error(err);
        this._changeDetectorRef.detectChanges();
      }
    });
  }

  compartirMiUbicacion(): void {
    if (this.enviandoUbicacion) return;
    this.enviandoUbicacion = true;
    this.mensaje = '';
    this._changeDetectorRef.detectChanges();

    this._geolocationService.obtenerUbicacionActual()
      .then((ubicacion) => {
        this.puntoPasajero = {
          latitud: ubicacion.latitud,
          longitud: ubicacion.longitud,
          etiqueta: 'Tu ubicacion',
          tipo: 'pasajero'
        };
        this._changeDetectorRef.detectChanges();

        this._pasajeroService.actualizarUbicacion(this.idPasajero, ubicacion).subscribe({
          next: () => {
            this.enviandoUbicacion = false;
            this.mensaje = 'Ubicacion compartida con el chofer.';
            this._changeDetectorRef.detectChanges();
          },
          error: (err) => {
            this.enviandoUbicacion = false;
            this.mensaje = err.error?.msg || 'No se pudo compartir tu ubicacion.';
            this._changeDetectorRef.detectChanges();
          }
        });
      })
      .catch((err) => {
        this.enviandoUbicacion = false;
        this.mensaje = 'No se pudo obtener tu ubicacion actual.';
        console.error(err);
        this._changeDetectorRef.detectChanges();
      });
  }

  comoLlegarAlChofer(): void {
    if (!this.puntoChofer) {
      this.actualizarUbicacionChofer();
      this.mensaje = 'Primero actualiza la ubicacion del chofer.';
      this._changeDetectorRef.detectChanges();
      return;
    }

    this._geolocationService.obtenerUbicacionActual()
      .then((ubicacion) => {
        this.puntoPasajero = {
          latitud: ubicacion.latitud,
          longitud: ubicacion.longitud,
          etiqueta: 'Tu ubicacion',
          tipo: 'pasajero'
        };
        this._changeDetectorRef.detectChanges();

        this._pasajeroService.actualizarUbicacion(this.idPasajero, ubicacion).subscribe({
          error: () => {}
        });

        this._rutaService.obtenerRuta(this.puntoPasajero, this.puntoChofer!).subscribe({
          next: (response) => {
            this.rutaGeoJson = response.routes?.[0]?.geometry;
            this._changeDetectorRef.detectChanges();
          },
          error: (err) => {
            this.mensaje = 'No se pudo calcular la ruta.';
            console.error(err);
            this._changeDetectorRef.detectChanges();
          }
        });
      })
      .catch((err) => {
        this.mensaje = 'No se pudo obtener tu ubicacion actual.';
        console.error(err);
        this._changeDetectorRef.detectChanges();
      });
  }

  getNombreChofer(viaje: ViajeCard): string {
    const usuario = viaje.chofer?.usuario;

    if (usuario) {
      return `${usuario.nombre} ${usuario.apellido}`;
    }

    return `Chofer #${viaje.idChofer || viaje.chofer?.idChofer || '-'}`;
  }

  getNombreChoferReserva(viaje: ViajeCard): string {
    const usuario =
      viaje.chofer?.usuario ||
      viaje.chofer?.Usuario;

    if (usuario?.nombre || usuario?.apellido) {
      return `${usuario?.nombre || ''} ${usuario?.apellido || ''}`.trim();
    }

    if (viaje.chofer?.nombre || viaje.chofer?.apellido) {
      return `${viaje.chofer?.nombre || ''} ${viaje.chofer?.apellido || ''}`.trim();
    }

    const idChofer = viaje.idChofer || viaje.chofer?.idChofer;

    return idChofer ? `Chofer #${idChofer}` : 'Chofer no asignado';
  }

  getAsientos(viaje: ViajeCard): number[] {
    const capacidad = viaje.auto?.capacidadAsientos || 4;
    return Array.from({ length: capacidad }, (_, index) => index + 1);
  }

  getAsientosOcupados(viaje: ViajeCard): number {
    const capacidad = viaje.auto?.capacidadAsientos || 4;
    return capacidad - viaje.asientosDisponibles;
  }

  private sincronizarPuntoChoferDesdeReserva(): void {
    if (this.pasajero?.latitud != null && this.pasajero?.longitud != null) {
      this.puntoPasajero = {
        latitud: Number(this.pasajero.latitud),
        longitud: Number(this.pasajero.longitud),
        etiqueta: 'Tu ubicacion',
        tipo: 'pasajero'
      };
    }

    const chofer = this.reservaActiva?.viaje?.chofer;

    if (!chofer?.latitud || !chofer?.longitud) {
      this.puntoChofer = undefined;
      this.rutaGeoJson = undefined;
      return;
    }

    this.puntoChofer = {
      latitud: Number(chofer.latitud),
      longitud: Number(chofer.longitud),
      etiqueta: 'Chofer',
      tipo: 'chofer'
    };
  }

  private getIdPasajeroSesion(): number {
    const sesion = sessionStorage.getItem('usuarioSesion');

    if (!sesion) return 0;

    const usuario = JSON.parse(sesion);
    return Number(usuario.idPasajero) || 0;
  }

  private escucharEvento<T>(evento: string, callback: (data: T) => void): void {
    this.eventosEscuchados.add(evento);
    this._socketService.escuchar<T>(evento, callback);
  }

  private manejarViajeActualizado(data: any): void {
    const idViajeEvento = Number(data?.idViaje);
    const viajeEncontrado = this.viajesDisponibles.find(v => Number(v.idViaje) === idViajeEvento);

    if (viajeEncontrado && data?.estadoViaje) {
      viajeEncontrado.estadoViaje = data.estadoViaje;
    }

    if (data?.estadoViaje && data.estadoViaje !== 'ABIERTO' && data.estadoViaje !== 'EN_CURSO') {
      this.viajesDisponibles = this.viajesDisponibles.filter(v => Number(v.idViaje) !== idViajeEvento);
    }

    if (Number(this.reservaActiva?.viaje?.idViaje) === idViajeEvento) {
      if (this.reservaActiva?.viaje && data?.estadoViaje) {
        this.reservaActiva.viaje.estadoViaje = data.estadoViaje;
      }

      if (data?.estadoViaje === 'EN_CURSO') {
        if (this.reservaActiva && this.reservaActiva.estadoReserva === 'PENDIENTE') {
          this.reservaActiva.estadoReserva = 'CONFIRMADA';
        }
        this.mensaje = 'El chofer inicio el viaje (EN CURSO).';
        this._toastr.info('Tu viaje esta en curso.');
        this._changeDetectorRef.detectChanges();
        this.loadPasajero();
        return;
      }

      if (data?.estadoViaje === 'FINALIZADO') {
        this.mensaje = 'Viaje finalizado.';
        this._toastr.success('Viaje finalizado.');
        this.reservaActiva = undefined;
        this.puntoChofer = undefined;
        this.puntoPasajero = undefined;
        this.rutaGeoJson = undefined;
        this._changeDetectorRef.detectChanges();
        this.loadPasajero();
        this.buscarViajes(true);
        return;
      }

      if (data?.estadoViaje === 'CANCELADO') {
        this.mensaje = 'El viaje fue cancelado.';
        this._toastr.warning('El viaje fue cancelado.');
        this.reservaActiva = undefined;
        this.puntoChofer = undefined;
        this.puntoPasajero = undefined;
        this.rutaGeoJson = undefined;
        this._changeDetectorRef.detectChanges();
        this.loadPasajero();
        this.buscarViajes(true);
        return;
      }

      this.mensaje = `El viaje cambio a estado ${data.estadoViaje}.`;
      this._changeDetectorRef.detectChanges();
      this.loadPasajero();
      return;
    }

    this._changeDetectorRef.detectChanges();
  }

  private manejarAsientosActualizados(data: any): void {
    const idViajeEvento = Number(data?.idViaje);
    if (Number(this.reservaActiva?.viaje?.idViaje) === idViajeEvento && this.reservaActiva?.viaje) {
      this.reservaActiva.viaje.asientosDisponibles = data.asientosDisponibles;
    }
    this.actualizarAsientosEnListado(idViajeEvento, data.asientosDisponibles);
  }

  private registrarEventosDeReservaActiva(): void {
    const idReserva = this.reservaActiva?.idReserva;
    const idViaje = this.reservaActiva?.viaje?.idViaje;

    if (!idReserva || !idViaje) return;

    // Eventos por reserva: solo afectan al pasajero que tiene esa reserva activa.
    this.escucharEvento<any>(`pago_confirmado_reserva_${idReserva}`, (data) => {
      if (this.reservaActiva && Number(this.reservaActiva.idReserva) === Number(idReserva)) {
        this.reservaActiva.estadoPago = data?.estadoPago || 'PAGADO';
        if (data?.estadoReserva) {
          this.reservaActiva.estadoReserva = data.estadoReserva;
        } else if (this.reservaActiva.estadoReserva === 'PENDIENTE') {
          this.reservaActiva.estadoReserva = 'CONFIRMADA';
        }
      }
      this.mensaje = 'El pago de tu reserva fue confirmado.';
      this._toastr.success('Pago en efectivo confirmado.');
      this._changeDetectorRef.detectChanges();
      this.loadPasajero();
    });

    this.escucharEvento<any>(`reserva_cancelada_${idReserva}`, () => {
      this.mensaje = 'Tu reserva fue cancelada.';
      this.reservaActiva = undefined;
      this.puntoChofer = undefined;
      this.puntoPasajero = undefined;
      this.rutaGeoJson = undefined;
      this._changeDetectorRef.detectChanges();
      this.loadPasajero();
      this.buscarViajes(true);
    });

    this.escucharEvento<any>(`reserva_actualizada_${idReserva}`, (data) => {
      if (data.estadoReserva === 'UTILIZADA') {
        this.mensaje = 'Viaje finalizado.';
        this._toastr.success('Viaje finalizado.');
        this.reservaActiva = undefined;
        this.puntoChofer = undefined;
        this.puntoPasajero = undefined;
        this.rutaGeoJson = undefined;
        this.loadPasajero();
        this.buscarViajes(true);
        this._changeDetectorRef.detectChanges();
        return;
      }

      if (data.estadoReserva === 'CANCELADA' || data.estadoReserva === 'NO_PRESENTADO') {
        this.mensaje = data.estadoReserva === 'NO_PRESENTADO' ? 'El chofer registro tu ausencia despues del horario confirmado y los 10 minutos de tolerancia.' : `Tu reserva cambio a estado ${data.estadoReserva}.`;
        this.reservaActiva = undefined;
        this.puntoChofer = undefined;
        this.puntoPasajero = undefined;
        this.rutaGeoJson = undefined;
        this.loadPasajero();
        this.buscarViajes(true);
        this._changeDetectorRef.detectChanges();
        return;
      }

      if (this.reservaActiva && Number(this.reservaActiva.idReserva) === Number(idReserva)) {
        if (data.estadoReserva) {
          this.reservaActiva.estadoReserva = data.estadoReserva;
        }
        if (data.estadoPago) {
          this.reservaActiva.estadoPago = data.estadoPago;
        }
        if (data.estadoViaje && this.reservaActiva.viaje) {
          this.reservaActiva.viaje.estadoViaje = data.estadoViaje;
        }
      }
      this.mensaje = `Tu reserva ahora esta ${data.estadoReserva}.`;
      this._changeDetectorRef.detectChanges();
      this.loadPasajero();
    });

    this.escucharEvento<any>(`viaje_actualizado_${idViaje}`, (data) => {
      this.manejarViajeActualizado(data);
    });

    this.escucharEvento<any>(`ubicacion_chofer_viaje_${idViaje}`, (data) => {
      this.puntoChofer = {
        latitud: Number(data.latitud),
        longitud: Number(data.longitud),
        etiqueta: 'Chofer',
        tipo: 'chofer'
      };

      this._changeDetectorRef.detectChanges();
    });

    this.escucharEvento<any>(`asientos_actualizados_viaje_${idViaje}`, (data) => {
      this.manejarAsientosActualizados(data);
    });
  }

  private registrarEventosDeViajesDisponibles(): void {
    this.viajesDisponibles.forEach((viaje) => {
      // Eventos por viaje: actualizan tanto las tarjetas disponibles como la reserva activa si coincide el idViaje.
      this.escucharEvento<any>(`asientos_actualizados_viaje_${viaje.idViaje}`, (data) => {
        this.manejarAsientosActualizados(data);
      });

      this.escucharEvento<any>(`viaje_actualizado_${viaje.idViaje}`, (data) => {
        this.manejarViajeActualizado(data);
      });
    });
  }

  private actualizarAsientosEnListado(idViaje: number, asientosDisponibles: number): void {
    const viaje = this.viajesDisponibles.find(v => v.idViaje === idViaje);

    if (viaje) {
      viaje.asientosDisponibles = asientosDisponibles;
    }

    this._changeDetectorRef.detectChanges();
  }
}
