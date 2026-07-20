import {
  coordsToKey,
  haversineDistance,
  haversineDistanceMeters,
  roundCoordinate,
} from '~/utils/geo';

describe('haversineDistance', () => {
  it('devuelve 0 para el mismo punto', () => {
    const point = { lat: 41.3874, lng: 2.1686 };
    expect(haversineDistance(point, point)).toBe(0);
  });

  it('calcula la distancia conocida entre Barcelona y Madrid (~505km)', () => {
    const barcelona = { lat: 41.3874, lng: 2.1686 };
    const madrid = { lat: 40.4168, lng: -3.7038 };
    const distance = haversineDistance(barcelona, madrid);
    expect(distance).toBeGreaterThan(495);
    expect(distance).toBeLessThan(515);
  });

  it('es simétrica entre los dos puntos', () => {
    const a = { lat: 10, lng: 20 };
    const b = { lat: -5, lng: -30 };
    expect(haversineDistance(a, b)).toBeCloseTo(haversineDistance(b, a), 10);
  });

  it('maneja coordenadas negativas y cruces de antimeridiano', () => {
    const a = { lat: 0, lng: 179 };
    const b = { lat: 0, lng: -179 };
    const distance = haversineDistance(a, b);
    // La distancia real cruzando el antimeridiano es corta (~222km), no la vuelta larga
    expect(distance).toBeGreaterThan(0);
    expect(distance).toBeLessThan(250);
  });
});

describe('haversineDistanceMeters', () => {
  it('es haversineDistance multiplicado por 1000', () => {
    const lat1 = 41.3874;
    const lon1 = 2.1686;
    const lat2 = 41.4;
    const lon2 = 2.2;
    const km = haversineDistance({ lat: lat1, lng: lon1 }, { lat: lat2, lng: lon2 });
    const meters = haversineDistanceMeters(lat1, lon1, lat2, lon2);
    expect(meters).toBeCloseTo(km * 1000, 6);
  });

  it('devuelve 0 para el mismo punto', () => {
    expect(haversineDistanceMeters(10, 10, 10, 10)).toBe(0);
  });
});

describe('roundCoordinate', () => {
  it('redondea a 3 decimales por defecto', () => {
    expect(roundCoordinate(2.168612345)).toBe(2.169);
  });

  it('redondea al número de decimales indicado', () => {
    expect(roundCoordinate(2.168612345, 5)).toBe(2.16861);
  });

  it('redondea a 0 decimales', () => {
    expect(roundCoordinate(2.5, 0)).toBe(3);
  });

  it('maneja números negativos', () => {
    expect(roundCoordinate(-3.14159, 2)).toBe(-3.14);
  });
});

describe('coordsToKey', () => {
  it('genera una clave estable "lat|lng" con redondeo a 3 decimales', () => {
    expect(coordsToKey({ lat: 41.387412345, lng: 2.168612345 })).toBe('41.387|2.169');
  });

  it('respeta el número de decimales indicado', () => {
    expect(coordsToKey({ lat: 41.387412345, lng: 2.168612345 }, 1)).toBe('41.4|2.2');
  });

  it('produce la misma clave para coordenadas que redondean igual', () => {
    const a = coordsToKey({ lat: 41.3871, lng: 2.1689 });
    const b = coordsToKey({ lat: 41.38704, lng: 2.16886 });
    expect(a).toBe(b);
  });
});
