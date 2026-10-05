import { manipulateAsync } from 'expo-image-manipulator';

import { computeUploadSize, resizeForUpload, UPLOAD_JPEG_QUALITY } from '../imageResize';

jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn(),
  SaveFormat: { JPEG: 'jpeg' },
}));

const mockManipulate = manipulateAsync as jest.Mock;

describe('computeUploadSize', () => {
  it('reduce una foto de 12 MP a la caja de bar manteniendo la proporción', () => {
    expect(computeUploadSize(4032, 2268, 'bar')).toEqual({ width: 1400, height: 788 });
  });

  it('limita por el lado que más sobresale', () => {
    // 3:4 vertical en caja de post (1200×675) → manda la altura
    expect(computeUploadSize(3024, 4032, 'post')).toEqual({ width: 506, height: 675 });
  });

  it('avatar cuadrado a 400×400', () => {
    expect(computeUploadSize(3000, 3000, 'avatar')).toEqual({ width: 400, height: 400 });
  });

  it('no amplía imágenes que ya caben', () => {
    expect(computeUploadSize(800, 600, 'menu')).toBeNull();
  });

  it('devuelve null si no hay dimensiones', () => {
    expect(computeUploadSize(0, 0, 'bar')).toBeNull();
  });
});

describe('resizeForUpload', () => {
  beforeEach(() => mockManipulate.mockReset());

  it('redimensiona y comprime cuando la imagen es grande', async () => {
    mockManipulate.mockResolvedValue({ uri: 'file://resized.jpg' });

    const uri = await resizeForUpload({ uri: 'file://big.jpg', width: 4032, height: 2268 }, 'bar');

    expect(uri).toBe('file://resized.jpg');
    expect(mockManipulate).toHaveBeenCalledWith(
      'file://big.jpg',
      [{ resize: { width: 1400, height: 788 } }],
      { compress: UPLOAD_JPEG_QUALITY, format: 'jpeg' }
    );
  });

  it('solo recomprime cuando la imagen ya cabe', async () => {
    mockManipulate.mockResolvedValue({ uri: 'file://compressed.jpg' });

    await resizeForUpload({ uri: 'file://small.jpg', width: 300, height: 300 }, 'avatar');

    expect(mockManipulate).toHaveBeenCalledWith('file://small.jpg', [], expect.any(Object));
  });

  it('devuelve la URI original si el manipulado falla', async () => {
    mockManipulate.mockRejectedValue(new Error('boom'));
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const uri = await resizeForUpload({ uri: 'file://big.jpg', width: 4000, height: 3000 }, 'bar');

    expect(uri).toBe('file://big.jpg');
    warn.mockRestore();
  });
});
