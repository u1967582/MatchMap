jest.mock('~/utils/supabase');
jest.mock('react-native-google-mobile-ads', () => ({ TestIds: {} }));
jest.mock('~/utils/ads', () => ({
  hasShownAppOpenAdThisSession: jest.fn(() => false),
  initializeAdsSDK: jest.fn(async () => true),
  isAdsPrivacyOptionsRequired: jest.fn(async () => false),
  loadAndShowAppOpenAdOnce: jest.fn(async () => {}),
  showAdsPrivacyOptions: jest.fn(async () => true),
}));

import React from 'react';
import { Pressable, Text } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { supabase } from '~/utils/supabase';
import * as ads from '~/utils/ads';
import { AdsProvider, useAds } from '~/contexts/AdsContext';

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

function AdsStateProbe() {
  const { adsReady, privacyOptionsRequired, openAdsPrivacyOptions } = useAds();
  return (
    <>
      <Text>{`ready:${adsReady}`}</Text>
      <Text>{`options:${privacyOptionsRequired}`}</Text>
      <Pressable onPress={openAdsPrivacyOptions}>
        <Text>abrir</Text>
      </Pressable>
    </>
  );
}

const renderProbe = () =>
  render(
    <AdsProvider>
      <AdsStateProbe />
    </AdsProvider>
  );

describe('useAds (consentimiento)', () => {
  it('adsReady es false fuera del provider', async () => {
    await render(<AdsStateProbe />);
    expect(screen.getByText('ready:false')).toBeTruthy();
  });

  it('adsReady empieza en false y pasa a true solo tras inicializar el SDK', async () => {
    let resolveInit: (v: boolean) => void = () => {};
    mockedAds.initializeAdsSDK.mockImplementationOnce(
      () => new Promise<boolean>((r) => (resolveInit = r))
    );
    await renderProbe();
    expect(screen.getByText('ready:false')).toBeTruthy();

    await act(async () => resolveInit(true));
    await waitFor(() => expect(screen.getByText('ready:true')).toBeTruthy());
  });

  it('adsReady sigue en false si no hay consentimiento (canRequestAds=false)', async () => {
    mockedAds.initializeAdsSDK.mockResolvedValueOnce(false);
    await renderProbe();
    await act(flush);
    expect(screen.getByText('ready:false')).toBeTruthy();
  });

  it('expone privacyOptionsRequired aunque se hayan rechazado los anuncios', async () => {
    mockedAds.initializeAdsSDK.mockResolvedValueOnce(false);
    mockedAds.isAdsPrivacyOptionsRequired.mockResolvedValueOnce(true);
    await renderProbe();
    await waitFor(() => expect(screen.getByText('options:true')).toBeTruthy());
  });

  it('si el usuario retira el consentimiento desde las opciones, deja de haber anuncios', async () => {
    mockedAds.isAdsPrivacyOptionsRequired.mockResolvedValueOnce(true);
    await renderProbe();
    await waitFor(() => expect(screen.getByText('ready:true')).toBeTruthy());

    mockedAds.showAdsPrivacyOptions.mockResolvedValueOnce(false);
    await act(async () => fireEvent.press(screen.getByText('abrir')));

    expect(mockedAds.showAdsPrivacyOptions).toHaveBeenCalled();
    await waitFor(() => expect(screen.getByText('ready:false')).toBeTruthy());
  });

  it('si el usuario concede el consentimiento desde las opciones, inicializa el SDK', async () => {
    mockedAds.initializeAdsSDK.mockResolvedValueOnce(false);
    await renderProbe();
    await act(flush);
    expect(screen.getByText('ready:false')).toBeTruthy();

    mockedAds.showAdsPrivacyOptions.mockResolvedValueOnce(true);
    mockedAds.initializeAdsSDK.mockResolvedValueOnce(true);
    await act(async () => fireEvent.press(screen.getByText('abrir')));

    await waitFor(() => expect(screen.getByText('ready:true')).toBeTruthy());
  });
});
