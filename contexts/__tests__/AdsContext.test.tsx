jest.mock('~/utils/supabase');
jest.mock('react-native-google-mobile-ads', () => ({ TestIds: {} }));
jest.mock('~/utils/ads', () => ({
  hasShownAppOpenAdThisSession: jest.fn(() => false),
  initializeAdsSDK: jest.fn(async () => true),
  loadAndShowAppOpenAdOnce: jest.fn(async () => {}),
}));

import React from 'react';
import { Text } from 'react-native';
import { render, screen, waitFor } from '@testing-library/react-native';
import { supabase } from '~/utils/supabase';
import * as ads from '~/utils/ads';
import { AdsProvider } from '~/contexts/AdsContext';

const mockedSupabase = supabase as any;
const mockedAds = ads as jest.Mocked<typeof ads>;

const flush = () => new Promise((r) => setImmediate(r));

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

const renderProvider = () =>
  render(
    <AdsProvider>
      <Text>app</Text>
    </AdsProvider>
  );

describe('AdsProvider', () => {
  it('renderiza los hijos siempre', async () => {
    await renderProvider();
    expect(screen.getByText('app')).toBeTruthy();
  });

  it('con sesión activa muestra el App Open Ad en el arranque', async () => {
    mockedSupabase.auth.getSession.mockResolvedValueOnce({ data: { session: { user: {} } } });
    await renderProvider();
    await waitFor(() => expect(mockedAds.loadAndShowAppOpenAdOnce).toHaveBeenCalledTimes(1));
  });

  it('sin sesión (pantalla de login) espera al login antes de mostrar el anuncio', async () => {
    let listener: any;
    const unsubscribe = jest.fn();
    mockedSupabase.auth.onAuthStateChange.mockImplementationOnce((cb: any) => {
      listener = cb;
      return { data: { subscription: { unsubscribe } } };
    });
    await renderProvider();
    await flush();
    expect(mockedAds.loadAndShowAppOpenAdOnce).not.toHaveBeenCalled();

    listener('SIGNED_IN', { user: {} });
    await flush();
    expect(mockedAds.loadAndShowAppOpenAdOnce).toHaveBeenCalledTimes(1);
    expect(unsubscribe).toHaveBeenCalled();
  });

  it('no muestra anuncio si los anuncios están desactivados (sin consentimiento, etc.)', async () => {
    mockedAds.initializeAdsSDK.mockResolvedValueOnce(false);
    mockedSupabase.auth.getSession.mockResolvedValueOnce({ data: { session: { user: {} } } });
    await renderProvider();
    await flush();
    expect(mockedAds.loadAndShowAppOpenAdOnce).not.toHaveBeenCalled();
  });

  it('si el SDK falla al iniciar la app sigue sin anuncios', async () => {
    mockedAds.initializeAdsSDK.mockRejectedValueOnce(new Error('sdk'));
    await renderProvider();
    await flush();
    expect(mockedAds.loadAndShowAppOpenAdOnce).not.toHaveBeenCalled();
    expect(screen.getByText('app')).toBeTruthy();
  });

  it('no repite el anuncio si ya se mostró en esta sesión', async () => {
    mockedAds.hasShownAppOpenAdThisSession.mockReturnValueOnce(true);
    mockedSupabase.auth.getSession.mockResolvedValueOnce({ data: { session: { user: {} } } });
    await renderProvider();
    await flush();
    expect(mockedAds.loadAndShowAppOpenAdOnce).not.toHaveBeenCalled();
  });

  it('un error al cargar el anuncio no rompe la app', async () => {
    mockedAds.loadAndShowAppOpenAdOnce.mockRejectedValueOnce(new Error('no fill'));
    mockedSupabase.auth.getSession.mockResolvedValueOnce({ data: { session: { user: {} } } });
    await renderProvider();
    await flush();
    expect(screen.getByText('app')).toBeTruthy();
  });
});
