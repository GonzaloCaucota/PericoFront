import { Component, OnInit, inject, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterLink, RouterModule } from '@angular/router';
import { LoginService, LoginPayload, UsuarioSesion } from '../../services/login-service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule,RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login implements OnInit {
  // Login permite autenticacion tradicional y Google Identity Services.
  private fb = inject(FormBuilder);
  private loginService = inject(LoginService); 
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private ngZone = inject(NgZone);

  loginForm!: FormGroup;
  cargando = false;
  mensajeError: string | null = null;
  mensajeExito: string | null = null;

  ngOnInit(): void {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required]
    });

    this.loadGoogleScript();

    (window as any).handleCredentialResponse = this.handleCredentialResponse.bind(this);
  }

  iniciarSesion(): void {
    this.mensajeError = null;
    this.mensajeExito = null;

    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.cargando = true;
    const credenciales: LoginPayload = this.loginForm.value;

    this.loginService.login(credenciales).subscribe({
      next: (res) => {
        this.cargando = false;

        if (res.status !== 1) {
          this.mensajeError = res.msg || 'Credenciales incorrectas';
          this.cdr.detectChanges();
          return;
        }
        
        this.procesarLoginExitoso(res);
      },
      error: (err) => {
        console.error('Error del servidor:', err);
        this.cargando = false;
        this.mensajeError = err.error?.msg || 'Error de conexión con el servidor. Intente más tarde.';
        this.cdr.detectChanges();
      }
    });
  }

  private loadGoogleScript(): void {
    const google = (window as any).google;

    if (google?.accounts?.id) {
      this.inicializarGoogleId();
    } else {
      if (!document.getElementById('google-gsi-script')) {
        const script = document.createElement('script');
        script.id = 'google-gsi-script';
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.onload = () => this.inicializarGoogleId();
        document.head.appendChild(script);
      }
    }
  }

  private inicializarGoogleId(): void {
    const google = (window as any).google;
    if (google) {
      google.accounts.id.initialize({
        client_id: '188387660446-6jqedllhbsmn42rh2uelnd3dvfpe7c8i.apps.googleusercontent.com',
        callback: this.handleCredentialResponse.bind(this),
        context: 'signin'
      });

      const contenedorBoton = document.getElementById('contenedorBotonGoogle');
      if (contenedorBoton) {
        google.accounts.id.renderButton(contenedorBoton, {
          type: 'standard',
          shape: 'rectangular',
          theme: 'outline',
          text: 'signin_with',
          size: 'large',
          logo_alignment: 'center'
        });
      }
    }
  }

  handleCredentialResponse(response: any): void {
    this.ngZone.run(() => {
      this.cargando = true;
      this.mensajeError = null;
      this.mensajeExito = null;

      const googleToken = response.credential;

      this.loginService.loginConGoogle(googleToken).subscribe({
        next: (res) => {
          this.cargando = false;
          if (res.status === 1) {
            this.procesarLoginExitoso(res);
          } else {
            this.mensajeError = res.msg;
            this.cdr.detectChanges();
          }
        },
        error: (err) => {
          console.error('Error de Google Login:', err);
          this.cargando = false;
          this.mensajeError = err.status === 401 
            ? 'Esta cuenta de Google no está registrada. Por favor, regístrate primero.' 
            : 'Error al comunicarse con el servidor. Intente más tarde.';
          this.cdr.detectChanges();
        }
      });
    });
  }

  private procesarLoginExitoso(res: any): void {
    // Extrae los datos de forma segura aunque el backend responda plano o anidado en usuario.
  const rol = res.rol || res.usuario?.rol;
    const idUsuario = res.idUsuario || res.usuario?.idUsuario;
    const nombre = res.nombre || res.usuario?.nombre;
    const apellido = res.apellido || res.usuario?.apellido;
    const email = res.email || res.usuario?.email;
    const telefono = res.telefono || res.usuario?.telefono;
    const token = res.token;
    const idChofer = res.idChofer || res.usuario?.idChofer || res.usuario?.perfilChofer?.idChofer;
    const idPasajero = res.idPasajero || res.usuario?.idPasajero || res.usuario?.perfilPasajero?.idPasajero;
    const idAdmin = res.idAdmin || res.usuario?.idAdmin || res.usuario?.perfilAdmin?.idAdmin;
    const estadoChofer = res.estadoChofer || res.usuario?.perfilChofer?.estadoChofer;
    const estadoPasajero = res.estadoPasajero || res.usuario?.perfilPasajero?.estadoPasajero;
    const estadoAdmin = res.estadoAdmin || res.usuario?.perfilAdmin?.estadoAdmin;

  // Validamos solo lo esencial para que la app funcione
  if (!token || !rol || !idUsuario || !email) {
    this.mensajeError = 'La respuesta del servidor no contiene los datos de sesión necesarios.';
    console.error('Datos faltantes:', { token, rol, idUsuario, email }); // Útil para ver qué falta en consola
    this.cdr.detectChanges();
    return;
  }

  // Construimos el objeto UsuarioSesion permitiendo nulos
  const usuarioSesion: UsuarioSesion = {
    idUsuario: idUsuario,
    idChofer: idChofer,
    idPasajero: idPasajero,
    idAdmin: idAdmin,
    rol: rol,
    nombre: nombre,
    apellido: apellido,
    email: email,
    telefono: telefono,
    estadoChofer: estadoChofer,
    estadoPasajero: estadoPasajero,
    estadoAdmin: estadoAdmin,
    token:  token,
  };

    this.loginService.guardarSesion(usuarioSesion);

    if (rol === 'CHOFER') {
      this.mensajeExito = 'Inicio de sesión exitoso. Redirigiendo a la página de conductor...';
      this.cdr.detectChanges();
      setTimeout(() => this.router.navigate(['/chofer']), 1500);
    } 
    else if (rol === 'PASAJERO') {
      this.mensajeExito = 'Inicio de sesión exitoso. Redirigiendo a la página de pasajero...';
      this.cdr.detectChanges();
      setTimeout(() => this.router.navigate(['/pasajero']), 1500);
    } 
    else if (rol === 'ADMIN') {
      this.mensajeExito = 'Inicio de sesión exitoso. Redirigiendo al panel administrador...';
      this.cdr.detectChanges();
      setTimeout(() => this.router.navigate(['/admin']), 1500);
    } 
    else {
      this.mensajeExito = 'Inicio de sesión exitoso. Redirigiendo al inicio...';
      this.cdr.detectChanges();
      setTimeout(() => this.router.navigate(['/home']), 1500);
    }
  }
}
