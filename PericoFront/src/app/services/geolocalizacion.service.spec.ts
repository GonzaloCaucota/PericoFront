import { GeolocationService } from './geolocalizacion.service';

describe('Geolocalizacion fresca y precisa', () => {
  let descriptor: PropertyDescriptor | undefined;
  beforeEach(() => { descriptor = Object.getOwnPropertyDescriptor(navigator, 'geolocation'); });
  afterEach(() => {
    if (descriptor) Object.defineProperty(navigator, 'geolocation', descriptor);
    else Reflect.deleteProperty(navigator, 'geolocation');
  });
  const geo = (getCurrentPosition: any) => Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition } });
  const position = (accuracy: number) => ({ coords: { latitude: -24.2, longitude: -65.3, accuracy } });
  it('conserva una lectura precisa del celular sin repetir el pedido', async () => {
    let llamadas = 0;
    geo((success: any, _: any, options: PositionOptions) => {
      llamadas++;
      expect(options.enableHighAccuracy).toBe(true);
      expect(options.maximumAge).toBe(0);
      success(position(12));
    });
    expect(await new GeolocationService().obtenerUbicacionActual()).toEqual({ latitud: -24.2, longitud: -65.3, precision: 12 });
    expect(llamadas).toBe(1);
  });
  it('reintenta una lectura imprecisa y acepta una mejora real', async () => {
    let llamadas = 0;
    geo((success: any, _: any, options: PositionOptions) => {
      expect(options.maximumAge).toBe(0);
      expect(options.enableHighAccuracy).toBe(true);
      success(position(++llamadas === 1 ? 15000 : 30));
    });
    expect((await new GeolocationService().obtenerUbicacionActual()).precision).toBe(30);
    expect(llamadas).toBe(2);
  });
  it('rechaza una estimacion a kilometros en lugar de compartirla', async () => {
    geo((success: any) => success(position(15000)));
    await expect(new GeolocationService().obtenerUbicacionActual()).rejects.toThrow('15000 m');
  });
  it('el reintento por timeout tampoco permite posiciones en cache', async () => {
    geo((success: any, failure: any, options: PositionOptions) => {
      expect(options.maximumAge).toBe(0);
      if (options.enableHighAccuracy) failure({ code: 3 });
      else success(position(80));
    });
    expect((await new GeolocationService().obtenerUbicacionActual()).precision).toBe(80);
  });
  it('respeta el permiso denegado sin reintentar', async () => {
    let llamadas = 0;
    geo((_: any, failure: any) => { llamadas++; failure({ code: 1 }); });
    await expect(new GeolocationService().obtenerUbicacionActual()).rejects.toThrow('permiso');
    expect(llamadas).toBe(1);
  });
});
