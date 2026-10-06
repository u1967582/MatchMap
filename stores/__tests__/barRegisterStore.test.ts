import { useBarRegisterStore } from '~/stores/barRegisterStore';

beforeEach(() => useBarRegisterStore.getState().resetForm());

describe('barRegisterStore', () => {
  it('setField actualiza un campo sin tocar el resto', () => {
    useBarRegisterStore.getState().setField('name', 'Bar Pepe');
    useBarRegisterStore.getState().setField('latitude', 41.38);
    const s = useBarRegisterStore.getState();
    expect(s.name).toBe('Bar Pepe');
    expect(s.latitude).toBe(41.38);
    expect(s.description).toBe('');
  });

  it('getFormData devuelve solo los datos del formulario (sin acciones ni categorías)', () => {
    const s = useBarRegisterStore.getState();
    s.setCategories([{ id: 'c1', name: 'Pub' }]);
    s.setField('barPhotos', ['a.jpg']);
    const data = useBarRegisterStore.getState().getFormData();
    expect(data.barPhotos).toEqual(['a.jpg']);
    expect(data).not.toHaveProperty('categories');
    expect(data).not.toHaveProperty('setField');
    expect(data).not.toHaveProperty('getFormData');
  });

  it('resetForm vuelve al estado inicial (también fotos y modo pre-registro)', () => {
    const s = useBarRegisterStore.getState();
    s.setField('name', 'X');
    s.setField('menuPhotos', ['m.jpg']);
    s.setField('isAutoPreRegister', true);
    s.setField('doorNumber', 5);
    useBarRegisterStore.getState().resetForm();
    const r = useBarRegisterStore.getState();
    expect(r.name).toBe('');
    expect(r.menuPhotos).toEqual([]);
    expect(r.isAutoPreRegister).toBe(false);
    expect(r.doorNumber).toBeNull();
  });
});
