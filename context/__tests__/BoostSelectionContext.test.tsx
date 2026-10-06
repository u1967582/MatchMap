import React from 'react';
import { act, renderHook } from '@testing-library/react-native';
import { BoostSelectionProvider, useBoostSelection } from '~/context/BoostSelectionContext';

const wrapper = ({ children }: any) => <BoostSelectionProvider>{children}</BoostSelectionProvider>;

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('BoostSelectionContext', () => {
  it('setSelectedBoostBarIds no re-renderiza si el array es igual', async () => {
    let renders = 0;
    const { result } = await renderHook(
      () => {
        renders++;
        return useBoostSelection();
      },
      { wrapper }
    );
    await act(async () => result.current.setSelectedBoostBarIds(['a', 'b']));
    const after = renders;
    const ref = result.current.selectedBoostBarIds;
    await act(async () => result.current.setSelectedBoostBarIds(['a', 'b']));
    expect(renders).toBe(after);
    expect(result.current.selectedBoostBarIds).toBe(ref);
  });

  it('setCenterLatLng aplica debounce de 300ms y se queda con la última posición', async () => {
    const { result } = await renderHook(() => useBoostSelection(), { wrapper });
    await act(async () => {
      result.current.setCenterLatLng({ lat: 41.0, lng: 2.0 });
      result.current.setCenterLatLng({ lat: 41.5, lng: 2.5 });
      jest.advanceTimersByTime(299);
    });
    expect(result.current.centerLatLng).toBeNull();
    await act(async () => {
      jest.advanceTimersByTime(1);
    });
    expect(result.current.centerLatLng).toEqual({ lat: 41.5, lng: 2.5 });
  });

  it('ignora movimientos de menos de 50m y aplica los mayores', async () => {
    const { result } = await renderHook(() => useBoostSelection(), { wrapper });
    await act(async () => {
      result.current.setCenterLatLng({ lat: 41.38, lng: 2.17 });
      jest.advanceTimersByTime(300);
    });
    const first = result.current.centerLatLng;

    await act(async () => {
      result.current.setCenterLatLng({ lat: 41.3801, lng: 2.17 }); // ~11m
      jest.advanceTimersByTime(300);
    });
    expect(result.current.centerLatLng).toBe(first);

    await act(async () => {
      result.current.setCenterLatLng({ lat: 41.39, lng: 2.17 }); // ~1.1km
      jest.advanceTimersByTime(300);
    });
    expect(result.current.centerLatLng).toEqual({ lat: 41.39, lng: 2.17 });
  });

  it('fuera del provider lanza un error claro', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(renderHook(() => useBoostSelection())).rejects.toThrow('BoostSelectionProvider');
  });
});
