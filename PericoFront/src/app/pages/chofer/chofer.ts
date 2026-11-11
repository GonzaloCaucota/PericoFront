import { RecorridoService } from '../../services/recorrido.service';
import { Recorrido } from '../../../models/recorrido.model';
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChoferService, Coordenadas, CrearAutoDto, CrearViajeDto } from '../../services/chofer.service';
import { ChoferModel } from '../../../models/chofer.model';
import { Auto } from '../../../models/auto.model';
import { Viaje } from '../../../models/viaje.model';
import { Reserva } from '../../../models/reserva.model';
import * as bootstrap from 'bootstrap';
import { GeolocationService } from '../../services/geolocalizacion.service';
import { MapaRutaComponent, PuntoMapa } from '../../components/mapa-ruta/mapa-ruta';
import { SocketService } from '../../services/socket.service';
import { NotificacionesService } from '../../services/notificaciones.service';

type AutoBack = Auto & {
  estado?: 'DISPONIBLE' | 'EN_VIAJE' | 'EN_TALLER' | 'INACTIVO';
};

type EstadoAuto = 'DISPONIBLE' | 'EN_VIAJE' | 'EN_TALLER' | 'INACTIVO';

type ViajeBack = Viaje & {
  idChofer?: number;
  idAuto?: number;
  auto?: AutoBack;
  reservas?: any[];
  asientosDisponibles?: number;
};

@Component({
  selector: 'app-chofer',
  standalone: true,
  imports: [CommonModule, FormsModule, MapaRutaComponent],
  templateUrl: './chofer.html',
  styleUrl: './chofer.scss'
})
export class Chofer implements OnInit {
  // Pantalla principal del chofer: disponibilidad, viaje actual, autos, pagos y ubicacion.
  public chofer?: ChoferModel;
  public autos: AutoBack[] = [];
  public autoAsignado?: AutoBack;
  public mostrarGestionAutos = false;
  public guardandoAuto = false;
  public autoEditandoId?: number;
  public estadosAuto: EstadoAuto[] = ['DISPONIBLE', 'EN_VIAJE', 'EN_TALLER', 'INACTIVO'];
  public autoForm: CrearAutoDto = {
    patente: '',
    marca: '',
    modelo: '',
    capacidadAsientos: 4,
    estado: 'DISPONIBLE'
  };
  public viajeActual?: ViajeBack;
  public asientos = [1, 2, 3, 4];
  public viajesHistorial: ViajeBack[] = [];
  public mostrarHistorial = false;
  public reserva: Reserva | null = null;

  public recorridos: Recorrido[] = [];
  public idRecorrido: number | null = null;
  public errorRecorridos = '';
  public tarifaPorAsiento = 1000;

  public idChofer = this.getIdChoferSesion();

  private modalAgregarPasajero!: bootstrap.Modal;
  private modalConfirmacion?: bootstrap.Modal;

  public latitud?: number;
  public longitud?: number;
  public precision?: number;
  public puntoChofer?: PuntoMapa;
  public mensajeUbicacion = '';
  public errorUbicacion = '';
  public cargandoUbicacion = false;

  private eventosEscuchados = new Set<string>();

  constructor(
    private _recorridoService: RecorridoService,
    private _choferService: ChoferService,
    private _geolocationService: GeolocationService,
    private _changeDetectorRef: ChangeDetectorRef,
    private _socketService: SocketService,
    private _toastr: NotificacionesService
  ) {}

  get invitadosConUbicacion(): any[] {
    return (this.viajeActual?.reservas || []).filter((r: any) =>
      ['PENDIENTE', 'CONFIRMADA'].includes(r.estadoReserva) &&
      ((r.invitado?.latitud != null && r.invitado?.longitud != null) ||
       (r.pasajero?.latitud != null && r.pasajero?.longitud != null))
    );
  }

  get reservasPendientesPago(): any[] {
    // Alimenta la lista "Cobros pendientes" del HTML.
    return (this.viajeActual?.reservas || []).filter((reserva) =>
      reserva.estadoPago !== 'PAGADO' &&
      reserva.estadoReserva !== 'CANCELADA' &&
      reserva.estadoReserva !== 'UTILIZADA'
    );
  }

  get recorridoSeleccionado(): Recorrido | undefined {
    return this.recorridos.find(recorrido => recorrido.idRecorrido === Number(this.idRecorrido));
  }

  ngOnInit(): void {
    this._recorridoService.listar().subscribe({
      next: recorridos => {
        this.recorridos = recorridos;
        this.idRecorrido = recorridos.find(r => r.codigo === 'SSJ_PERICO')?.idRecorrido ?? recorridos[0]?.idRecorrido ?? null;
        this._changeDetectorRef.detectChanges();
      },
      error: () => { this.errorRecorridos = 'No se pudieron cargar los recorridos. Recarga la pagina para reintentar.'; this._changeDetectorRef.detectChanges(); }
    });
    if (!this.idChofer) {
      console.error('No hay idChofer en sesion');
      this.resolverChoferDesdeUsuarioSesion();
      return;
    }

    this.cargarPanelChofer();
  }

  private cargarPanelChofer(): void {
    // Carga datos independientes del panel. Cada metodo consume un endpoint distinto.
    this.loadChofer();
    this.loadAutos();
    this.loadViajes();
  }

  ngAfterViewInit(): void {
    const modalAgregar = document.getElementById('modalAgregarPasajero');

    if (modalAgregar) {
      this.modalAgregarPasajero = new bootstrap.Modal(modalAgregar);
    }

    const modalConfirmacion = document.getElementById('modalConfirmacionAccion');

    if (modalConfirmacion) {
      this.modalConfirmacion = new bootstrap.Modal(modalConfirmacion);
    }
  }

  loadChofer(): void {
    this._choferService.getChoferById(this.idChofer).subscribe({
      next: (data) => {
        this.chofer = data;

        if (
          data.latitud !== null &&
          data.latitud !== undefined &&
          data.longitud !== null &&
          data.longitud !== undefined
        ) {
          this.latitud = Number(data.latitud);
          this.longitud = Number(data.longitud);
          this.precision =
            data.precision !== null && data.precision !== undefined
              ? Number(data.precision)
              : undefined;

          this.puntoChofer = {
            latitud: this.latitud,
            longitud: this.longitud,
            etiqueta: 'Mi ubicacion',
            tipo: 'chofer'
          };
        }

        this._changeDetectorRef.detectChanges();
      },
      error: (err) => {
        console.error('Error al cargar chofer:', err);
      }
    });
  }

  loadAutos(): void {
    this._choferService.getAutosByChofer(this.idChofer).subscribe({
      next: (data) => {
        this.autos = data as AutoBack[];
        this.autoAsignado = this.autos.find((auto) => this.esAutoDisponible(auto)) || this.autos[0];

        if (!this.autoAsignado) {
          this.mostrarGestionAutos = true;
          this._toastr.info('Registra un auto para poder crear viajes.');
          this._changeDetectorRef.detectChanges();
          return;
        }

        this._changeDetectorRef.detectChanges();
      },
      error: (err) => {
        console.error('Error al cargar autos del chofer:', err);
        this._toastr.error('Error al cargar autos del chofer.');
      }
    });
  }

  toggleGestionAutos(): void {
    this.mostrarGestionAutos = !this.mostrarGestionAutos;
  }

  get autosActivos(): AutoBack[] {
    return this.autos.filter((auto) => this.getEstadoAutoItem(auto) !== 'INACTIVO');
  }

  get puedeDarAltaAuto(): boolean {
    return this.autosActivos.length < 3 || this.autoEditandoId !== undefined;
  }

  guardarAuto(): void {
    const datosAuto = this.normalizarAutoForm();

    if (!datosAuto) return;

    if (!this.autoEditandoId && this.autosActivos.length >= 3) {
      this._toastr.warning('Solo podes tener hasta 3 autos activos.');
      return;
    }

    this.guardandoAuto = true;

    if (this.autoEditandoId) {
      this._choferService.actualizarAuto(this.autoEditandoId, datosAuto).subscribe({
        next: () => {
          this._toastr.success('Auto actualizado correctamente.');
          this.finalizarGuardadoAuto();
        },
        error: (err) => {
          this.guardandoAuto = false;
          this._toastr.error(err.error?.msg || 'No se pudo actualizar el auto.');
          console.error('Error al actualizar auto:', err);
        }
      });

      return;
    }

    this._choferService.crearAuto(datosAuto).subscribe({
      next: (response) => {
        if (!response.auto?.idAuto) {
          this._toastr.success('Auto registrado correctamente.');
          this.finalizarGuardadoAuto();
          return;
        }

        this._choferService.crearTurnoChofer({
          idChofer: this.idChofer,
          idAuto: response.auto.idAuto,
          fecha: this.getFechaActual(),
          horaInicio: '00:00:00',
          horaFin: '23:59:59'
        }).subscribe({
          next: () => {
            this._toastr.success('Auto registrado correctamente.');
            this.finalizarGuardadoAuto();
          },
          error: (err) => {
            this.guardandoAuto = false;
            this._toastr.error('El auto se creo, pero no se pudo asociar al chofer.');
            console.error('Error al asociar auto al chofer:', err);
          }
        });
      },
      error: (err) => {
        this.guardandoAuto = false;
        this._toastr.error(err.error?.msg || 'No se pudo registrar el auto.');
        console.error('Error al registrar auto:', err);
      }
    });
  }

  editarAuto(auto: AutoBack): void {
    this.autoEditandoId = auto.idAuto;
    this.autoForm = {
      patente: auto.patente || '',
      marca: auto.marca || '',
      modelo: auto.modelo || '',
      capacidadAsientos: Number(auto.capacidadAsientos) || 4,
      estado: this.getEstadoAutoItem(auto)
    };
    this.mostrarGestionAutos = true;
  }

  cancelarEdicionAuto(): void {
    this.resetAutoForm();
  }

  cambiarEstadoAuto(auto: AutoBack, estado: EstadoAuto): void {
    if (estado !== 'INACTIVO' && this.getEstadoAutoItem(auto) === 'INACTIVO' && this.autosActivos.length >= 3) {
      this._toastr.warning('Solo podes tener hasta 3 autos activos.');
      return;
    }

    this._choferService.cambiarEstadoAuto(auto.idAuto, estado).subscribe({
      next: () => {
        this._toastr.success('Estado del auto actualizado.');
        this.loadAutos();
      },
      error: (err) => {
        this._toastr.error(err.error?.msg || 'No se pudo cambiar el estado del auto.');
        console.error('Error al cambiar estado del auto:', err);
      }
    });
  }

  darBajaAuto(auto: AutoBack): void {
    this.cambiarEstadoAuto(auto, 'INACTIVO');
  }

  getEstadoAutoItem(auto: AutoBack): EstadoAuto {
    return (auto.estado || auto.estadoAuto || 'DISPONIBLE') as EstadoAuto;
  }

  private finalizarGuardadoAuto(): void {
    this.guardandoAuto = false;
    this.resetAutoForm();
    this.loadAutos();
  }

  private resetAutoForm(): void {
    this.autoEditandoId = undefined;
    this.autoForm = {
      patente: '',
      marca: '',
      modelo: '',
      capacidadAsientos: 4,
      estado: 'DISPONIBLE'
    };
  }

  private normalizarAutoForm(): CrearAutoDto | null {
    const patente = this.autoForm.patente.trim().toUpperCase();
    const marca = this.autoForm.marca.trim();
    const modelo = this.autoForm.modelo.trim();
    const capacidadAsientos = Number(this.autoForm.capacidadAsientos);
    const estado = this.autoForm.estado || 'DISPONIBLE';

    if (!patente || !marca || !modelo) {
      this._toastr.warning('Completa patente, marca y modelo.');
      return null;
    }

    if (!Number.isInteger(capacidadAsientos) || capacidadAsientos < 1) {
      this._toastr.warning('La capacidad debe ser un numero entero mayor a 0.');
      return null;
    }

    return {
      patente,
      marca,
      modelo,
      capacidadAsientos,
      estado
    };
  }

  loadViajes(): void {
    this._choferService.getViajesDelChofer(this.idChofer).subscribe({
      next: (data) => {
        const viajes = data as ViajeBack[];

        // En el panel se muestra como actual el viaje publicado o ya iniciado.
        this.viajeActual = viajes.find((viaje) =>
          viaje.estadoViaje === 'ABIERTO' || viaje.estadoViaje === 'EN_CURSO'
        );

        if (this.viajeActual?.reservas) {
          this.viajeActual.reservas = this.viajeActual.reservas
            .filter((reserva) => reserva.estadoReserva !== 'CANCELADA')
            .map((reserva: any) => {
              const origenUbicacion = reserva.invitado?.latitud != null && reserva.invitado?.longitud != null
                ? {
                    latitud: Number(reserva.invitado.latitud),
                    longitud: Number(reserva.invitado.longitud),
                    precision: reserva.invitado.precision,
                    actualizadaAt: reserva.invitado.ubicacionActualizadaAt,
                    nombre: reserva.invitado.nombre
                  }
                : reserva.pasajero?.latitud != null && reserva.pasajero?.longitud != null
                  ? {
                      latitud: Number(reserva.pasajero.latitud),
                      longitud: Number(reserva.pasajero.longitud),
                      precision: reserva.pasajero.precision,
                      actualizadaAt: reserva.pasajero.updatedAt,
                      nombre: `${reserva.pasajero.usuario?.nombre || 'Pasajero'} ${reserva.pasajero.usuario?.apellido || ''}`.trim()
                    }
                  : null;
              return {
                ...reserva,
                ubicacionCompartida: origenUbicacion,
                puntoMapaPasajero: origenUbicacion
                  ? {
                      latitud: origenUbicacion.latitud,
                      longitud: origenUbicacion.longitud,
                      etiqueta: origenUbicacion.nombre,
                      tipo: 'pasajero' as const
                    }
                  : undefined
              };
            });
        }

        this.registrarEventosDeViajeActual();
        this.registrarEventosDeReservasDelViaje();

        this.viajesHistorial = viajes.filter((viaje) =>
          viaje.estadoViaje === 'FINALIZADO' || viaje.estadoViaje === 'CANCELADO'
        );

        this._changeDetectorRef.detectChanges();
      },
      error: (err) => {
        console.error('Error al cargar viajes del chofer:', err);
      }
    });
  }

  cambiarDisponibilidad(activo: boolean): void {
    const nuevoEstado = activo ? 'DISPONIBLE' : 'DESCANSO';

    this._choferService.updateEstadoChofer(this.idChofer, nuevoEstado).subscribe({
      next: (response) => {
        this.chofer = response.chofer || response;
        this._changeDetectorRef.detectChanges();
      },
      error: (err) => {
        console.error('Error al actualizar estado del chofer:', err);
      }
    });
  }

  get puedeCrearViaje(): boolean {
    return (
      this.autoAsignado !== undefined &&
      this.recorridoSeleccionado !== undefined &&
      this.tarifaPorAsiento > 0 &&
      !this.viajeActual
    );
  }

  get textoAccionCierreViaje(): string {
    if (this.viajeActual?.estadoViaje === 'EN_CURSO') {
      return 'Finalizar viaje';
    }

    return 'Cancelar viaje';
  }

  get iconoAccionCierreViaje(): string {
    if (this.viajeActual?.estadoViaje === 'EN_CURSO') {
      return 'bi-stop-circle';
    }

    return 'bi-x-circle';
  }

  get claseAccionCierreViaje(): string {
    if (this.viajeActual?.estadoViaje === 'EN_CURSO') {
      return 'btn-outline-dark';
    }

    return 'btn-outline-danger';
  }

  crearNuevoViaje(): void {
    if (!this.autoAsignado) {
      console.error('No hay auto asignado para crear el viaje');
      this._toastr.warning('Necesitas un auto disponible para crear el viaje.');
      return;
    }

    if (!this.recorridoSeleccionado || !Number.isFinite(this.tarifaPorAsiento) || this.tarifaPorAsiento <= 0) {
      this._toastr.warning('Selecciona un recorrido y una tarifa positiva.');
      return;
    }

    // El backend completa estado ABIERTO y asientos segun la capacidad del auto.
    const nuevoViaje: CrearViajeDto = {
      idRecorrido: this.recorridoSeleccionado.idRecorrido,
      fechaSalida: this.getFechaActual(),
      horaSalida: this.getHoraActual(),
      tarifaPorAsiento: this.tarifaPorAsiento,
      idChofer: this.idChofer,
      idAuto: this.autoAsignado.idAuto
    };

    this._choferService.crearViaje(nuevoViaje).subscribe({
      next: () => {
        this._toastr.success('Viaje creado correctamente.');
        this.loadViajes();
        this.loadChofer();
      },
      error: (err) => {
        this._toastr.error(err.error?.msg || 'Error al crear nuevo viaje.');
        console.error('Error al crear nuevo viaje:', err);
      }
    });
  }

  iniciarViaje(): void {
    if (!this.viajeActual) return;

    if (this.viajeActual.estadoViaje !== 'ABIERTO') {
      this._toastr.warning('Solo se puede iniciar un viaje abierto.');
      return;
    }

    this.confirmarInicioViaje();
  }
  finalizarViaje(): void {
    if (!this.viajeActual) return;

    const estaEnCurso = this.viajeActual.estadoViaje === 'EN_CURSO';

    if (estaEnCurso) {
      this.abrirModalConfirmacion({
        titulo: 'Finalizar viaje',
        mensaje: '¿Seguro que queres finalizar este viaje? Esta acción marcará el viaje como completado.',
        textoConfirmar: 'Finalizar viaje',
        icono: 'bi-stop-circle',
        variante: 'dark',
        accion: () => this.confirmarCambioEstadoViaje('FINALIZADO')
      });

      return;
    }

    this.abrirModalConfirmacion({
      titulo: 'Cancelar viaje',
      mensaje: '¿Seguro que queres cancelar este viaje? El viaje dejará de estar disponible para pasajeros.',
      textoConfirmar: 'Cancelar viaje',
      icono: 'bi-x-circle',
      variante: 'danger',
      accion: () => this.confirmarCambioEstadoViaje('CANCELADO')
    });
  }

  registrarPagoEfectivo(reserva: any): void {
    if (reserva.estadoPago === 'PAGADO') return;

    this._choferService.registrarPagoEfectivo(reserva.idReserva).subscribe({
      next: () => {
        reserva.estadoPago = 'PAGADO';
        this._toastr.success(`Pago registrado para la reserva #${reserva.idReserva}.`);
        this.loadViajes();
      },
      error: (err) => {
        console.error('Error al registrar pago en efectivo:', err);
        this._toastr.error(err.error?.mensaje || 'No se pudo registrar el pago.');
      }
    });
  }

  abrirModalAgregarPasajero(): void {
    if (!this.viajeActual) {
      console.error('No hay viaje actual para agregar pasajero');
      return;
    }

    if (this.viajeActual.asientosDisponibles <= 0) {
      this._toastr.warning('No hay asientos disponibles para agregar pasajeros.');
      return;
    }

    this.confirmarAgregarPasajero();
  }

  public confirmacionModal: ConfirmacionModal = {
    titulo: '',
    mensaje: '',
    textoConfirmar: '',
    icono: 'bi-question-circle',
    variante: 'primary',
    accion: null
  };

  abrirModalConfirmacion(config: ConfirmacionModal): void {
    this.confirmacionModal = config;
    this.modalConfirmacion?.show();
  }

  private confirmarInicioViaje(): void {
    if (!this.viajeActual) return;

    this._choferService.cambiarEstadoViaje(
      this.viajeActual.idViaje,
      'EN_CURSO'
    ).subscribe({
      next: () => {
        if (this.viajeActual) {
          this.viajeActual.estadoViaje = 'EN_CURSO';
        }

        this._toastr.success('Viaje iniciado correctamente.');
        this._changeDetectorRef.detectChanges();
        this.loadViajes();
      },
      error: (err) => {
        this._toastr.error('Error al iniciar viaje.');
        console.error('Error al iniciar viaje:', err);
      }
    });
  }

  confirmarAccionModal(): void {
    const accion = this.confirmacionModal.accion;

    this.modalConfirmacion?.hide();

    if (accion) {
      accion();
    }
  }

  confirmarAgregarPasajero(): void {
    if (!this.viajeActual || this.viajeActual.asientosDisponibles <= 0) {
      return;
    }

    // Pasajero manual: no crea usuario ni reserva, solo ocupa un asiento del viaje.
    const nuevosAsientos = this.viajeActual.asientosDisponibles - 1;

    this._choferService.actualizarAsientosDisponibles(
      this.viajeActual.idViaje,
      nuevosAsientos
    ).subscribe({
      next: (response: any) => {
        this.viajeActual = response.viaje || this.viajeActual;
        this._toastr.success('Pasajero manual agregado.');
        this.loadViajes();
        (document.activeElement as HTMLElement)?.blur();
        this.modalAgregarPasajero?.hide();
      },
      error: (err) => {
        this._toastr.error('No se pudo agregar el pasajero manual.');
        console.error(err);
      }
    });
  }

  private confirmarCambioEstadoViaje(nuevoEstado: 'FINALIZADO' | 'CANCELADO'): void {
    if (!this.viajeActual) return;

    const accionTexto = nuevoEstado === 'FINALIZADO' ? 'finalizar' : 'cancelar';

    this._choferService.cambiarEstadoViaje(
      this.viajeActual.idViaje,
      nuevoEstado
    ).subscribe({
      next: () => {
        if (nuevoEstado === 'FINALIZADO') {
          this._toastr.success('Viaje finalizado correctamente.');
        } else {
          this._toastr.warning('Viaje cancelado correctamente.');
        }

        this.viajeActual = undefined;
        this._changeDetectorRef.detectChanges();
        this.loadViajes();
      },
      error: (err) => {
        this._toastr.error(`No se pudo ${accionTexto} el viaje.`);
        console.error(`Error al ${accionTexto} viaje:`, err);
      }
    });
  }

  agregarPasajeroManual(): void {
    if (!this.viajeActual || this.viajeActual.asientosDisponibles <= 0) {
      console.error('No hay asientos disponibles para agregar pasajero');
      return;
    }

    const nuevosAsientos = this.viajeActual.asientosDisponibles - 1;

    this._choferService.actualizarAsientosDisponibles(
      this.viajeActual.idViaje,
      nuevosAsientos
    ).subscribe({
      next: (response: any) => {
        this.viajeActual = response.viaje || response;
        this._changeDetectorRef.detectChanges();
        console.log('Asiento agregado, viaje actualizado:', this.viajeActual);
      },
      error: (err) => {
        console.error('Error al agregar pasajero:', err);
      }
    });
  }

  enviarUbicacion(): void {
    this.cargandoUbicacion = true;
    this.mensajeUbicacion = '';
    this.errorUbicacion = '';
    this._changeDetectorRef.detectChanges();

    this._geolocationService.obtenerUbicacionActual()
      .then((ubicacion) => {
        this.publicarUbicacion(ubicacion);
      })
      .catch((error) => {
        console.error(error);
        this.errorUbicacion = 'No se pudo obtener la ubicacion del dispositivo.';
        this.cargandoUbicacion = false;
        this._changeDetectorRef.detectChanges();
      });
  }

  private publicarUbicacion(ubicacion: Coordenadas): void {
    this.latitud = ubicacion.latitud;
    this.longitud = ubicacion.longitud;
    this.precision = ubicacion.precision;

    this.puntoChofer = {
      latitud: ubicacion.latitud,
      longitud: ubicacion.longitud,
      etiqueta: 'Mi ubicacion',
      tipo: 'chofer'
    };
    this._changeDetectorRef.detectChanges();

    this._choferService.actualizarUbicacion(this.idChofer, ubicacion).subscribe({
      next: () => {
        this.mensajeUbicacion = 'Ubicacion enviada correctamente.';
        this.cargandoUbicacion = false;
        this._changeDetectorRef.detectChanges();
      },
      error: (error) => {
        console.error(error);
        this.errorUbicacion = error.error?.msg || 'Error enviando ubicacion al backend.';
        this.cargandoUbicacion = false;
        this._changeDetectorRef.detectChanges();
      }
    });
  }

  toggleHistorial(): void {
    this.mostrarHistorial = !this.mostrarHistorial;
  }

  getEstadoAuto(): string {
    return this.autoAsignado?.estado || this.autoAsignado?.estadoAuto || 'SIN AUTO';
  }

  private esAutoDisponible(auto: AutoBack): boolean {
    return (auto.estado || auto.estadoAuto) === 'DISPONIBLE';
  }

  private getIdChoferSesion(): number {
    const sesion = sessionStorage.getItem('usuarioSesion');

    if (!sesion) return 0;

    try {
      const usuario = JSON.parse(sesion);
      return Number(
        usuario.idChofer ||
        usuario.perfilChofer?.idChofer ||
        usuario.usuario?.idChofer ||
        usuario.usuario?.perfilChofer?.idChofer
      ) || 0;
    } catch (error) {
      console.error('No se pudo leer la sesion del chofer:', error);
      return 0;
    }
  }

  private getIdUsuarioSesion(): number {
    const sesion = sessionStorage.getItem('usuarioSesion');

    if (!sesion) return 0;

    try {
      const usuario = JSON.parse(sesion);
      return Number(usuario.idUsuario || usuario.usuario?.idUsuario) || 0;
    } catch (error) {
      console.error('No se pudo leer el usuario de la sesion:', error);
      return 0;
    }
  }

  private resolverChoferDesdeUsuarioSesion(): void {
    const idUsuario = this.getIdUsuarioSesion();

    if (!idUsuario) {
      this._toastr.error('No se encontro el perfil de chofer en la sesion. Volve a iniciar sesion.');
      return;
    }

    this._choferService.getChoferes().subscribe({
      next: (choferes) => {
        const chofer = choferes.find((item) => Number(item.idUsuario) === idUsuario);

        if (!chofer?.idChofer) {
          this._toastr.error('No se encontro el perfil de chofer asociado a tu usuario.');
          return;
        }

        this.idChofer = chofer.idChofer;
        this.actualizarIdChoferSesion(chofer.idChofer);
        this.cargarPanelChofer();
      },
      error: (error) => {
        console.error('Error resolviendo el perfil de chofer:', error);
        this._toastr.error('No se pudo cargar el perfil de chofer.');
      }
    });
  }

  private actualizarIdChoferSesion(idChofer: number): void {
    const sesion = sessionStorage.getItem('usuarioSesion');

    if (!sesion) return;

    try {
      const usuario = JSON.parse(sesion);
      usuario.idChofer = idChofer;
      sessionStorage.setItem('usuarioSesion', JSON.stringify(usuario));
    } catch (error) {
      console.error('No se pudo actualizar la sesion del chofer:', error);
    }
  }

  private getFechaActual(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private getHoraActual(): string {
    return new Date().toTimeString().slice(0, 8);
  }

  private escucharEvento<T>(evento: string, callback: (data: T) => void): void {
    if (this.eventosEscuchados.has(evento)) return;

    this.eventosEscuchados.add(evento);
    this._socketService.escuchar<T>(evento, callback);
  }

  private registrarEventosDeViajeActual(): void {
    const idViaje = this.viajeActual?.idViaje;

    if (!idViaje) return;

    this.escucharEvento<any>(`ubicacion_invitado_viaje_${idViaje}`, () => this.loadViajes());

    // Eventos especificos por idViaje para que varios choferes no mezclen actualizaciones.
    this.escucharEvento<any>(`reserva_creada_viaje_${idViaje}`, (data) => {
      this.loadViajes();
    });

    this.escucharEvento<any>(`pago_actualizado_viaje_${idViaje}`, (data) => {
      this.mensajeUbicacion = 'Se actualizo el pago de una reserva.';
      this._toastr.success(`Pago confirmado de la reserva #${data.idReserva}.`);
      this.loadViajes();
    });

    this.escucharEvento<any>(`asientos_actualizados_viaje_${idViaje}`, (data) => {
      if (!this.viajeActual) return;

      if (this.viajeActual.idViaje === data.idViaje) {
        this.viajeActual.asientosDisponibles = data.asientosDisponibles;
        this._toastr.info('Los asientos disponibles del viaje fueron actualizados.');
        this.loadViajes();
      }
    });

    this.escucharEvento<any>(`viaje_actualizado_${idViaje}`, (data) => {
      if (!this.viajeActual) return;

      if (this.viajeActual.idViaje === data.idViaje) {
        this.viajeActual.estadoViaje = data.estadoViaje;
        this._changeDetectorRef.detectChanges();
      }

      this.loadViajes();
    });
  }

  private registrarEventosDeReservasDelViaje(): void {
    const reservas = this.viajeActual?.reservas || [];

    reservas.forEach((reserva) => {
      this.escucharEvento<any>(`pago_confirmado_reserva_${reserva.idReserva}`, (data) => {
        reserva.estadoPago = data.estadoPago;
        reserva.estadoReserva = data.estadoReserva;

        this.mensajeUbicacion = `Pago confirmado de la reserva #${data.idReserva}.`;
        this._toastr.success(`Pago confirmado de la reserva #${data.idReserva}.`);


        this._changeDetectorRef.detectChanges();
      });

      this.escucharEvento<any>(`reserva_cancelada_${reserva.idReserva}`, (data) => {
        this._toastr.warning(`La reserva #${data.idReserva} fue cancelada.`);
        this.loadViajes();
      });
    });
  }
}

type ConfirmacionModal = {
  titulo: string;
  mensaje: string;
  textoConfirmar: string;
  icono: string;
  variante: 'primary' | 'danger' | 'dark' | 'warning';
  accion: (() => void) | null;
};
