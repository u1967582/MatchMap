jest.mock('~/utils/supabase');
jest.mock('~/utils/revenuecat', () => ({
  initializeRevenueCat: jest.fn(async () => {}),
  getCustomerInfo: jest.fn(async () => ({ id: 'info' })),
  hasActiveBoost: jest.fn(async () => false),
  purchasePackage: jest.fn(),
  restorePurchases: jest.fn(),
  syncRevenueCatUser: jest.fn(async () => {}),
}));

import React from 'react';
import { Text } from 'react-native';
import { act, render, renderHook, screen, waitFor } from '@testing-library/react-native';
import { supabase } from '~/utils/supabase';
import * as RC from '~/utils/revenuecat';
import { RevenueCatProvider, useRevenueCat } from '~/contexts/RevenueCatContext';

const mockedSupabase = supabase as any;
const rc = RC as jest.Mocked<typeof RC>;

let authListener: ((event: string, session: any) => void) | undefined;
let unsubscribe: jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  authListener = undefined;
  unsubscribe = jest.fn();
  mockedSupabase.auth.onAuthStateChange.mockImplementation((cb: any) => {
    authListener = cb;
    return { data: { subscription: { unsubscribe } } };
  });
});
afterEach(() => jest.restoreAllMocks());

const wrapper = ({ children }: any) => <RevenueCatProvider>{children}</RevenueCatProvider>;

async function renderCtx() {
  const hook = await renderHook(() => useRevenueCat(), { wrapper });
  await waitFor(() => expect(hook.result.current?.isLoading).toBe(false));
  return hook;
}

describe('RevenueCatProvider', () => {
  it('inicializa RevenueCat con el usuario de Supabase y carga el estado del boost', async () => {
    mockedSupabase.auth.getUser.mockResolvedValueOnce({
      data: { user: { id: 'u1' } },
      error: null,
    });
    rc.hasActiveBoost.mockResolvedValueOnce(true);

    const { result } = await renderCtx();

    expect(rc.initializeRevenueCat).toHaveBeenCalledWith('u1');
    expect(result.current.customerInfo).toEqual({ id: 'info' });
    expect(result.current.hasActiveBoost).toBe(true);
  });

  it('si RevenueCat falla al iniciar, la app sigue funcionando', async () => {
    rc.initializeRevenueCat.mockRejectedValueOnce(new Error('sin red'));
    await render(
      <RevenueCatProvider>
        <Text>contenido</Text>
      </RevenueCatProvider>
    );
    await waitFor(() => expect(screen.getByText('contenido')).toBeTruthy());
  });

  // El provider difiere la sincronización con setTimeout(0) para no bloquear supabase-js
  const emit = async (event: string, session: any) => {
    await act(async () => {
      authListener!(event, session);
      await new Promise((r) => setTimeout(r, 0));
    });
  };

  it('sincroniza RevenueCat con el usuario que inicia sesión después del arranque', async () => {
    await renderCtx();
    expect(authListener).toBeDefined();
    await emit('SIGNED_IN', { user: { id: 'owner-1' } });
    await waitFor(() => expect(rc.syncRevenueCatUser).toHaveBeenCalledWith('owner-1'));
  });

  it('al cerrar sesión sincroniza con null (no comparte compras entre cuentas)', async () => {
    await renderCtx();
    await emit('SIGNED_OUT', null);
    await waitFor(() => expect(rc.syncRevenueCatUser).toHaveBeenCalledWith(null));
  });

  it('ignora otros eventos de auth', async () => {
    await renderCtx();
    await emit('TOKEN_REFRESHED', { user: { id: 'u1' } });
    expect(rc.syncRevenueCatUser).not.toHaveBeenCalled();
  });

  it('se desuscribe al desmontar', async () => {
    const { unmount } = await renderCtx();
    await unmount();
    expect(unsubscribe).toHaveBeenCalled();
  });

  it('purchasePackage devuelve true y actualiza el boost; false si el usuario cancela', async () => {
    const { result } = await renderCtx();
    rc.purchasePackage.mockResolvedValueOnce({
      customerInfo: { id: 'new' } as any,
      transaction: {},
      success: true,
    });
    rc.hasActiveBoost.mockResolvedValueOnce(true);

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.purchasePackage({} as any);
    });
    expect(ok).toBe(true);
    expect(result.current.hasActiveBoost).toBe(true);

    rc.purchasePackage.mockRejectedValueOnce({ userCancelled: true });
    await act(async () => {
      ok = await result.current.purchasePackage({} as any);
    });
    expect(ok).toBe(false);
  });

  it('restorePurchases relanza el error para que la UI lo muestre', async () => {
    const { result } = await renderCtx();
    rc.restorePurchases.mockRejectedValueOnce(new Error('no purchases'));
    await expect(result.current.restorePurchases()).rejects.toThrow('no purchases');
  });

  it('useRevenueCat fuera del provider lanza un error claro', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(renderHook(() => useRevenueCat())).rejects.toThrow('RevenueCatProvider');
  });
});
