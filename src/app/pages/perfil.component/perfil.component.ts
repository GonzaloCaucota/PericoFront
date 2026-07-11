import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { LoginService } from '../../services/login-service';
@Component({
  selector: 'app-perfil.component',
  imports: [CommonModule],
  templateUrl: './perfil.component.html',
  styleUrl: './perfil.component.scss',
})
export class PerfilComponent {

usuario: any = {};

constructor(private loginService: LoginService) {}

ngOnInit() {
  this.usuario = this.loginService.usuarioSesionSignal();
}
}
