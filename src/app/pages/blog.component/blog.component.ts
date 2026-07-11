import { Component, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';

interface ArticuloBlog {
  id: number;
  titulo: string;
  resumen: string;
  categoria: string;
  fecha: string;
  icono: string;
  colorIcono: string;
}

@Component({
  selector: 'app-blog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './blog.component.html',
  styleUrl: './blog.component.scss',
})
export class BlogComponent {
 @ViewChild('carrusel') carrusel!: ElementRef;

  desplazar(direccion: number): void {
    if (this.carrusel) {
      const anchoDesplazamiento = 340; 
      this.carrusel.nativeElement.scrollBy({ 
        left: anchoDesplazamiento * direccion, 
        behavior: 'smooth' 
      });
    }
  }

  articulos: ArticuloBlog[] = [
    {
      id: 1,
      titulo: 'Guía práctica: Cómo registrar tu Monotributo para conducir',
      resumen: 'Te explicamos paso a paso los requisitos fiscales ante AFIP para facturar tus viajes de forma legal y sin complicaciones.',
      categoria: 'Conductores',
      fecha: '05 de Julio, 2026',
      icono: 'bi-file-earmark-text',
      colorIcono: 'text-primary'
    },
    {
      id: 2,
      titulo: '5 Consejos de seguridad para tus viajes nocturnos',
      resumen: 'Tu tranquilidad es lo primero. Conocé las herramientas de la app como compartir viaje y el botón de asistencia en tiempo real.',
      categoria: 'Seguridad',
      fecha: '28 de Junio, 2026',
      icono: 'bi-shield-lock',
      colorIcono: 'text-success'
    },
    {
      id: 3,
      titulo: 'Mantenimiento preventivo: Alargá la vida útil de tu auto',
      resumen: 'Revisión técnica, filtros y neumáticos. Una lista de chequeo esencial para garantizar un servicio seguro y ahorrar dinero.',
      categoria: 'Vehículos',
      fecha: '15 de Junio, 2026',
      icono: 'bi-wrench-adjustable',
      colorIcono: 'text-warning'
    },
    {
      id: 4,
      titulo: 'Guía Turística: Los mejores destinos de Jujuy para recomendar',
      resumen: 'Desde las ferias de Perico hasta los paisajes de la Quebrada. Qué responder cuando tus pasajeros te preguntan "¿Qué puedo visitar?".',
      categoria: 'Guía de Viaje',
      fecha: '02 de Junio, 2026',
      icono: 'bi-map',
      colorIcono: 'text-danger'
    },
    {
      id: 5,
      titulo: 'Conocé la nueva actualización del panel de conductores',
      resumen: 'Lanzamos nuevas métricas en tiempo real. Ahora podés ver tus ganancias diarias y calificación promedio con un solo toque.',
      categoria: 'Novedades App',
      fecha: '20 de Mayo, 2026',
      icono: 'bi-phone-vibrate',
      colorIcono: 'text-info'
    },
    {
      id: 6,
      titulo: 'Climatización óptima: Ahorrá combustible en verano',
      resumen: 'El uso correcto del aire acondicionado mejora el confort del pasajero y reduce el consumo de nafta. Descubrí el balance perfecto.',
      categoria: 'Tips de Ahorro',
      fecha: '10 de Mayo, 2026',
      icono: 'bi-snow',
      colorIcono: 'text-primary'
    }
  ];
}

