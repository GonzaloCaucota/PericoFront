import { Component, ViewChild, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { RegistroAdminDTO, RegistroService } from '../../services/registro-service';
import { LoginService } from '../../services/login-service';
import { GestionUsuariosService } from '../../services/gestion-usuarios.service'; 
import { AdminDashboard } from '../admin-dashboard/admin-dashboard';

type VistaAdmin = 'dashboard' | 'pasajeros' | 'choferes' | 'registrar-admin' | 'alta-usuario' | 'autos';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, AdminDashboard], 
  templateUrl: './admin.html',
  styleUrl: './admin.scss',
})
export class AdminPage implements OnInit {
  @ViewChild(AdminDashboard) dashboard?: AdminDashboard;

  private fb = inject(FormBuilder);
  private registroService = inject(RegistroService);
  public loginService = inject(LoginService);
  private gestionUsuarios = inject(GestionUsuariosService); 
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  vistaActual: VistaAdmin = 'dashboard';
  listaUsuarios: any[] = [];
  textoFiltro = '';
  modoEdicion = false;

  adminForm: FormGroup = this.fb.group({
    nombre: ['', Validators.required],
    apellido: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    telefono: ['', Validators.required],
    passwordHash: ['', [Validators.required, Validators.minLength(6)]],
    estadoAdmin: ['ACTIVO', Validators.required],
  });

  motivoModeracion = '';
  mensajeModeracion = '';
  errorModeracion = '';
  procesandoModeracion = false;
  listaAutos: any[] = [];
  altaForm = this.fb.group({
    tipo: ['CHOFER', Validators.required], nombre: ['', Validators.required], apellido: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]], telefono: ['', Validators.required],
    passwordHash: ['', [Validators.required, Validators.minLength(12)]], licenciaConducir: [''], fechaHabilitacion: ['']
  });

  darAlta(): void {
    if (this.altaForm.invalid) { this.altaForm.markAllAsTouched(); return; }
    const datos = this.altaForm.getRawValue();
    if (datos.tipo === 'CHOFER' && (!datos.licenciaConducir?.trim() || !datos.fechaHabilitacion)) {
      this.errorModeracion = 'Completa licencia y fecha de habilitacion del chofer.'; return;
    }
    this.procesandoModeracion = true;
    this.errorModeracion = ''; this.mensajeModeracion = '';
    this.gestionUsuarios.altaUsuario(datos.tipo as 'CHOFER' | 'PASAJERO', datos).subscribe({
      next: res => { this.procesandoModeracion = false; this.mensajeModeracion = res.mensaje; this.altaForm.reset({ tipo: 'CHOFER' }); this.cdr.detectChanges(); },
      error: err => { this.procesandoModeracion = false; this.errorModeracion = err.error?.mensaje || err.error?.error || 'No se pudo dar de alta'; this.cdr.detectChanges(); }
    });
  }

  moderar(item: any, accion: 'aprobar' | 'activar' | 'bloquear'): void {
    if (accion === 'bloquear' && this.motivoModeracion.trim().length < 5) { this.errorModeracion = 'Escribe un motivo de al menos 5 caracteres antes de bloquear.'; return; }
    const tipo = this.vistaActual === 'choferes' ? 'choferes' : 'pasajeros';
    const id = tipo === 'choferes' ? item.idChofer : item.idPasajero;
    this.procesandoModeracion = true; this.errorModeracion = ''; this.mensajeModeracion = '';
    this.gestionUsuarios.moderar(tipo, id, accion, this.motivoModeracion).subscribe({
      next: res => { this.procesandoModeracion = false; this.mensajeModeracion = res.mensaje; this.motivoModeracion = ''; tipo === 'choferes' ? this.cargarChoferes() : this.cargarPasajeros(); this.cdr.detectChanges(); },
      error: err => { this.procesandoModeracion = false; this.errorModeracion = err.error?.mensaje || 'No se pudo realizar la accion'; this.cdr.detectChanges(); }
    });
  }

  cargarAutos(): void {
    this.gestionUsuarios.obtenerAutos().subscribe({ next: autos => { this.listaAutos = autos; this.cdr.detectChanges(); }, error: () => { this.errorModeracion = 'No se pudieron cargar los vehiculos'; this.cdr.detectChanges(); } });
  }
  cambiarHabilitacionAuto(auto: any): void {
    if (auto.estado !== 'INACTIVO' && this.motivoModeracion.trim().length < 5) { this.errorModeracion = 'Escribe un motivo de al menos 5 caracteres.'; return; }
    this.procesandoModeracion = true; this.errorModeracion = ''; this.mensajeModeracion = '';
    this.gestionUsuarios.habilitarAuto(auto.idAuto, auto.estado === 'INACTIVO' ? 'DISPONIBLE' : 'INACTIVO', this.motivoModeracion).subscribe({
      next: res => { this.procesandoModeracion = false; this.mensajeModeracion = res.mensaje; this.motivoModeracion = ''; this.cargarAutos(); this.cdr.detectChanges(); },
      error: err => { this.procesandoModeracion = false; this.errorModeracion = err.error?.mensaje || 'No se pudo modificar el vehiculo'; this.cdr.detectChanges(); }
    });
  }

  editarForm!: FormGroup;
  cargandoRegistro = false;
  cargandoBusqueda = false;
  cargandoEdicion = false;
  usuarioEncontrado: any = null;

  mensajeExito = '';
  mensajeError = '';
  mensajeEdicionExito = '';
  mensajeEdicionError = '';

  constructor() {
    const usuario = this.loginService.usuarioSesionSignal();
    if (!usuario || usuario.rol !== 'ADMIN') {
      this.router.navigate(['/login']);
    }
  }

  ngOnInit(): void {
    this.inicializarFormularioEdicion();
  }

  get usuariosFiltrados(): any[] {
    const termino = this.textoFiltro.trim().toLowerCase();
    if (!termino) return this.listaUsuarios;

    return this.listaUsuarios.filter((item) => {
      const datos = `${item.usuario?.nombre} ${item.usuario?.apellido} ${item.usuario?.email}`.toLowerCase();
      return datos.includes(termino);
    });
  }

  // === CONTROL DE VISTAS Y CARGA DE DATOS ===
  cambiarVista(vista: VistaAdmin): void {
    this.vistaActual = vista;
    this.mensajeModeracion = ''; this.errorModeracion = ''; this.motivoModeracion = '';
    if (vista === 'autos') this.cargarAutos();
    this.modoEdicion = false;
    this.textoFiltro = '';
    this.usuarioEncontrado = null;

    if (vista === 'pasajeros') {
      this.cargarPasajeros();
    } else if (vista === 'choferes') {
      this.cargarChoferes();
    }
  }

  cargarPasajeros(): void {
    this.cargandoBusqueda = true;
    this.gestionUsuarios.obtenerPasajeros().subscribe({
      next: (data) => {
        this.listaUsuarios = data;
        this.cargandoBusqueda = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error al cargar pasajeros:', err);
        this.cargandoBusqueda = false;
      }
    });
  }

  cargarChoferes(): void {
    this.cargandoBusqueda = true;
    this.gestionUsuarios.obtenerChoferes().subscribe({
      next: (data) => {
        this.listaUsuarios = data;
        this.cargandoBusqueda = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error al cargar choferes:', err);
        this.cargandoBusqueda = false;
      }
    });
  }
  inicializarFormularioEdicion(): void {
    this.editarForm = this.fb.group({
      nombre: ['', Validators.required],
      apellido: ['', Validators.required],
      telefono: ['', Validators.required],
      estado: ['', Validators.required],
      licenciaConducir: [''],
      fechaHabilitacion: [''],
      password: ['']
    });
  }

  abrirEdicion(itemBd: any): void {
    this.usuarioEncontrado = itemBd;
    this.modoEdicion = true;
    this.mensajeEdicionExito = '';
    this.mensajeEdicionError = '';

    this.editarForm.patchValue({
      nombre: itemBd.usuario?.nombre,
      apellido: itemBd.usuario?.apellido,
      telefono: itemBd.usuario?.telefono,
      estado: this.vistaActual === 'pasajeros' ? itemBd.estadoPasajero : itemBd.estadoChofer,
      licenciaConducir: itemBd.licenciaConducir || '',
      fechaHabilitacion: itemBd.fechaHabilitacion || '',
      password: '' 
    });
  }

  cancelarEdicion(): void {
    this.modoEdicion = false;
    this.usuarioEncontrado = null;
    this.mensajeEdicionExito = '';
    this.mensajeEdicionError = '';
  }

  actualizarUsuario(): void {
    if (this.editarForm.invalid || !this.usuarioEncontrado) return;

    this.cargandoEdicion = true;
    this.mensajeEdicionExito = '';
    this.mensajeEdicionError = '';

    const payload: any = {
      nombre: this.editarForm.value.nombre,
      apellido: this.editarForm.value.apellido,
      telefono: this.editarForm.value.telefono,
      licenciaConducir: this.editarForm.value.licenciaConducir,
      fechaHabilitacion: this.editarForm.value.fechaHabilitacion
    };
    const nuevaClave = this.editarForm.value.password?.trim();
    if (nuevaClave) {
      payload.password = nuevaClave; 
    }

    const id = this.vistaActual === 'pasajeros' 
      ? this.usuarioEncontrado.idPasajero 
      : this.usuarioEncontrado.idChofer;

    const peticion$ = this.vistaActual === 'pasajeros'
      ? this.gestionUsuarios.actualizarPasajero(id, payload)
      : this.gestionUsuarios.actualizarChofer(id, payload);

    peticion$.subscribe({
      next: (res: any) => {
        this.cargandoEdicion = false;
    
        this.mensajeEdicionExito = res.mensaje || res.msg || 'Usuario actualizado correctamente.';
        
        if (this.vistaActual === 'pasajeros') this.cargarPasajeros();
        else this.cargarChoferes();
        
        this.dashboard?.cargarDashboard();
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.cargandoEdicion = false;
        this.mensajeEdicionError = err.error?.mensaje || err.error?.msg || 'Error al actualizar el usuario.';
        this.cdr.detectChanges();
      }
    });
  }

  registrarAdmin(): void {
    this.mensajeExito = '';
    this.mensajeError = '';
    if (this.adminForm.invalid) { this.adminForm.markAllAsTouched(); return; }
    
    this.cargandoRegistro = true;
    this.registroService.registrarAdmin(this.adminForm.value).subscribe({
      next: () => {
        this.cargandoRegistro = false;
        this.mensajeExito = 'Admin registrado correctamente.';
        this.adminForm.reset({ estadoAdmin: 'ACTIVO' });
        this.dashboard?.cargarDashboard();
      },
      error: (error) => {
        this.cargandoRegistro = false;
        this.mensajeError = error.error?.msg || 'No se pudo registrar el admin.';
      }
    });
  }
}