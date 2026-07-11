import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { RegistroService, RegistroPasajeroDTO, RegistroChoferDTO } from '../../services/registro-service';

@Component({
  selector: 'app-registrar-usuario',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './registrar-usuario.html'
})
export class RegistrarUsuario implements OnInit {
  private fb = inject(FormBuilder);
  private registroService = inject(RegistroService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private cdr = inject(ChangeDetectorRef);

  registroForm!: FormGroup;
  rolSeleccionado: 'PASAJERO' | 'CHOFER' = 'PASAJERO';
  cargando = false;
  mensajeError: string | null = null;
  mensajeExito: string | null = null;
  emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  phonePattern = /^\d{10,13}$/;
  passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
  showPassword = false;

  ngOnInit(): void {
    this.registroForm = this.fb.group({
      nombre: ['', Validators.required],
      apellido: ['', Validators.required],
      email: ['', [Validators.required, Validators.pattern(this.emailPattern)]],
      telefono: ['', [Validators.required, Validators.pattern(this.phonePattern)]],
      passwordHash: ['', [Validators.required, Validators.pattern(this.passwordPattern)]],
      licenciaConducir: [''], 
      fechaHabilitacion: ['']
    });

    this.route.queryParams.subscribe(params => {
      if (params['tipo'] === 'chofer') {
        this.cambiarRol('CHOFER');
      } else {
        this.cambiarRol('PASAJERO');
      }
    });
  }

  cambiarRol(rol: 'PASAJERO' | 'CHOFER'): void {
    this.mensajeError = null;
    this.mensajeExito = null;
    this.rolSeleccionado = rol;
    
    const licenciaCtrl = this.registroForm.get('licenciaConducir');
    const fechaCtrl = this.registroForm.get('fechaHabilitacion');

    if (rol === 'CHOFER') {
      licenciaCtrl?.setValidators([Validators.required]);
      fechaCtrl?.setValidators([Validators.required]);
    } else {
      licenciaCtrl?.clearValidators();
      fechaCtrl?.clearValidators();
      licenciaCtrl?.setValue('');
      fechaCtrl?.setValue('');
    }

    licenciaCtrl?.updateValueAndValidity();
    fechaCtrl?.updateValueAndValidity();
  }

  registrarUsuario(): void {
    this.mensajeError = null;

    if (this.registroForm.invalid) {
      this.registroForm.markAllAsTouched();
      return;
    }

    this.cargando = true;
    const esPasajero = this.rolSeleccionado === 'PASAJERO';

    const peticion$ = esPasajero 
      ? this.registroService.registrarPasajero(this.obtenerPayloadPasajero())
      : this.registroService.registrarChofer(this.obtenerPayloadChofer());

    peticion$.subscribe({
      next: (res) => this.manejarExito(res, esPasajero ? 'Pasajero' : 'Chofer'),
      error: (err) => this.manejarError(err, esPasajero)
    });
  }

  private obtenerPayloadPasajero(): RegistroPasajeroDTO {
    const { nombre, apellido, email, telefono, passwordHash } = this.registroForm.value;
    return { nombre, apellido, email, telefono, passwordHash };
  }

  private obtenerPayloadChofer(): RegistroChoferDTO {
    const { nombre, apellido, email, telefono, passwordHash, licenciaConducir, fechaHabilitacion } = this.registroForm.value;
    return { nombre, apellido, email, telefono, passwordHash, licenciaConducir, fechaHabilitacion };
  }

  private manejarExito(res: any, tipoUsuario: string): void {
    console.log(`${tipoUsuario} registrado`, res);
    this.cargando = false;
    this.mensajeExito = `${tipoUsuario} registrado correctamente. Redirigiendo al login...`;
    this.cdr.detectChanges();
    
    setTimeout(() => {
      this.router.navigate(['/login']);
    }, 2500);
  }

  private manejarError(err: any, esPasajero: boolean): void {
    console.error(err);
    this.cargando = false;
    
    const mensajeBackend = err.error?.error || err.error?.msg || '';
    const errorClaveDuplicada = mensajeBackend.includes('llave duplicada') || mensajeBackend.includes('unique');

    if (errorClaveDuplicada) {
      this.mensajeError = esPasajero 
        ? 'Este correo electrónico ya se encuentra registrado.' 
        : 'Este correo electrónico o licencia ya se encuentra registrado/a.';
    } else {
      this.mensajeError = 'Ocurrió un error al registrar el usuario. Intente nuevamente.';
    }
    
    this.cdr.detectChanges();
  }

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

}
