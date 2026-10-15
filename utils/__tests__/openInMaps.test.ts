import { Linking } from 'react-native';
import { buildMapsUrls, openInMaps, openPhoneDialer } from '~/utils/openInMaps';

const openURL = jest.spyOn(Linking, 'openURL');

const BAR = { latitude: 41.3874, longitude: 2.1686, name: 'Bar Pepe & Co' };

beforeEach(() => {
  openURL.mockReset();
});

describe('buildMapsUrls', () => {
  it('iOS: Apple Maps (enlace universal) y, como respaldo, Google Maps web', () => {
    expect(buildMapsUrls(BAR, 'ios')).toEqual([
      'https://maps.apple.com/?daddr=41.3874,2.1686&q=Bar%20Pepe%20%26%20Co',
      'https://www.google.com/maps/dir/?api=1&destination=41.3874,2.1686',
    ]);
  });

  it('Android: intent geo: con etiqueta y, como respaldo, Google Maps web', () => {
    expect(buildMapsUrls(BAR, 'android')).toEqual([
      'geo:0,0?q=41.3874,2.1686(Bar%20Pepe%20%26%20Co)',
      'https://www.google.com/maps/dir/?api=1&destination=41.3874,2.1686',
    ]);
  });

  it('web u otra plataforma: solo Google Maps web', () => {
    expect(buildMapsUrls(BAR, 'web')).toEqual([
      'https://www.google.com/maps/dir/?api=1&destination=41.3874,2.1686',
    ]);
  });

  it('sin nombre usa "Destino"', () => {
    expect(buildMapsUrls({ latitude: 1, longitude: 2, name: '  ' }, 'ios')[0]).toContain(
      'q=Destino'
    );
  });
});

describe('openInMaps', () => {
  it('abre la primera URL de la plataforma', async () => {
    openURL.mockResolvedValueOnce(true);

    expect(await openInMaps(BAR, 'ios')).toBe(true);
    expect(openURL).toHaveBeenCalledTimes(1);
    expect(openURL.mock.calls[0][0]).toMatch(/^https:\/\/maps\.apple\.com/);
  });

  it('si la app de mapas no se puede abrir, usa Google Maps en el navegador', async () => {
    openURL.mockRejectedValueOnce(new Error('no handler')).mockResolvedValueOnce(true);

    expect(await openInMaps(BAR, 'android')).toBe(true);
    expect(openURL).toHaveBeenCalledTimes(2);
    expect(openURL.mock.calls[1][0]).toMatch(/^https:\/\/www\.google\.com\/maps/);
  });

  it('devuelve false si no se puede abrir nada', async () => {
    openURL.mockRejectedValue(new Error('no handler'));
    expect(await openInMaps(BAR, 'android')).toBe(false);
  });

  it.each([
    [{ latitude: NaN, longitude: 2 }],
    [{ latitude: 1, longitude: Infinity }],
    [{ latitude: 0, longitude: 0 }],
  ])('no intenta abrir nada con coordenadas no válidas (%o)', async (dest) => {
    expect(await openInMaps(dest, 'ios')).toBe(false);
    expect(openURL).not.toHaveBeenCalled();
  });
});

describe('openPhoneDialer', () => {
  it('limpia el número y abre tel:', async () => {
    openURL.mockResolvedValueOnce(true);
    expect(await openPhoneDialer('+34 932 12-34-56')).toBe(true);
    expect(openURL).toHaveBeenCalledWith('tel:+34932123456');
  });

  it('sin dígitos no abre nada', async () => {
    expect(await openPhoneDialer('sin teléfono')).toBe(false);
    expect(openURL).not.toHaveBeenCalled();
  });

  it('devuelve false si el dispositivo no puede llamar', async () => {
    openURL.mockRejectedValueOnce(new Error('no tel'));
    expect(await openPhoneDialer('600000000')).toBe(false);
  });
});
