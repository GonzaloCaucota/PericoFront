import { of } from 'rxjs';
import { PasajeroComponent } from './pasajero';

describe('Finalizacion del viaje del pasajero', () => {
  it('recupera el viaje completado aunque se haya perdido el evento y limpia el mapa', () => {
    const reserva = { idReserva: 8, estadoReserva: 'UTILIZADA', viaje: { idViaje: 3, estadoViaje: 'FINALIZADO' } };
    const component = new PasajeroComponent({} as any, { getPasajeroById: () => of({ reservas: [reserva] }) } as any,
      {} as any, {} as any, { detectChanges: () => {} } as any, {} as any, {} as any);
    component.reservaActiva = { ...reserva, estadoReserva: 'CONFIRMADA' } as any;
    component.puntoChofer = { latitud: 1, longitud: 1 } as any;
    component.loadPasajero();
    expect(component.reservaActiva).toBeUndefined();
    expect(component.viajeFinalizado?.idReserva).toBe(8);
    expect(component.puntoChofer).toBeUndefined();
  });
  it('no presenta un viaje cancelado como completado', () => {
    const component = new PasajeroComponent({} as any, { getPasajeroById: () => of({ reservas: [
      { idReserva: 8, estadoReserva: 'CANCELADA', viaje: { estadoViaje: 'CANCELADO' } }
    ] }) } as any, {} as any, {} as any, { detectChanges: () => {} } as any, {} as any, {} as any);
    component.loadPasajero();
    expect(component.viajeFinalizado).toBeUndefined();
  });
});
