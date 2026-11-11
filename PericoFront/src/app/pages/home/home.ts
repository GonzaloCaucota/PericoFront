import { ViajesPublicos } from '../../components/viajes-publicos/viajes-publicos';
import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { RecorridoService } from '../../services/recorrido.service';
import { Recorrido } from '../../../models/recorrido.model';

@Component({
  selector: 'app-home',
  imports: [CommonModule, RouterLink, ViajesPublicos],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home implements OnInit {
  private servicio = inject(RecorridoService);
  private detector = inject(ChangeDetectorRef);
  recorridos: Recorrido[] = [];
  errorRecorridos = '';
  ngOnInit(): void {
    this.servicio.listar().subscribe({
      next: recorridos => { this.recorridos = recorridos.filter(r => r.codigo.startsWith('SSJ_')); this.detector.markForCheck(); },
      error: () => { this.errorRecorridos = 'No se pudieron cargar los recorridos en este momento.'; this.detector.markForCheck(); }
    });
  }
}
