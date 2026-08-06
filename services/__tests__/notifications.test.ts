import { Platform } from 'react-native';
import { createQueryBuilderMock } from '../../test-utils/mockSupabase';

jest.mock('~/utils/supabase');

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(() => Promise.resolve()),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
  AndroidImportance: { HIGH: 4 },
}));

jest.mock('expo-device', () => ({
  isDevice: true,
  modelId: 'iPhone14,2',
  modelName: null,
}));

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: { extra: { eas: { projectId: 'test-project-id' } } },
    easConfig: { projectId: 'test-project-id' },
  },
}));

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '~/utils/supabase';
import {
  configureNotificationHandler,
  getExpoPushToken,
  registerPushToken,
  unregisterCurrentPushToken,
  requestMatchNotificationsPermission,
  fetchMatchNotificationsEnabled,
  setMatchNotificationsEnabled,
} from '~/services/notifications';

const mockedFrom = supabase.from as jest.Mock;
const mockedRpc = supabase.rpc as jest.Mock;
const originalPlatformOS = Platform.OS;

beforeEach(() => {
  jest.clearAllMocks();
  (Device as any).isDevice = true;
  (Device as any).modelId = 'iPhone14,2';
  (Device as any).modelName = null;
  (Constants as any).expoConfig = { extra: { eas: { projectId: 'test-project-id' } } };
  (Constants as any).easConfig = { projectId: 'test-project-id' };
  Platform.OS = originalPlatformOS;
  AsyncStorage.clear();
});

describe('configureNotificationHandler', () => {
  it('configura el handler de notificaciones', () => {
    configureNotificationHandler();

    expect(Notifications.setNotificationHandler).toHaveBeenCalledWith(
      expect.objectContaining({ handleNotification: expect.any(Function) })
    );
  });

  it('crea el canal de Android solo en Android', () => {
    Platform.OS = 'android';

    configureNotificationHandler();

    expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith(
      'default',
      expect.objectContaining({ name: 'default' })
    );
  });

  it('no crea el canal de Android en iOS', () => {
    Platform.OS = 'ios';

    configureNotificationHandler();

    expect(Notifications.setNotificationChannelAsync).not.toHaveBeenCalled();
  });
});

describe('getExpoPushToken', () => {
  it('devuelve null si el dispositivo no es físico', async () => {
    (Device as any).isDevice = false;

    const token = await getExpoPushToken();

    expect(token).toBeNull();
    expect(Notifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
  });

  it('devuelve null si no hay projectId configurado', async () => {
    (Constants as any).expoConfig = { extra: {} };
    (Constants as any).easConfig = {};

    const token = await getExpoPushToken();

    expect(token).toBeNull();
  });

  it('devuelve el token del dispositivo', async () => {
    (Notifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValueOnce({
      data: 'ExponentPushToken[abc]',
    });

    const token = await getExpoPushToken();

    expect(Notifications.getExpoPushTokenAsync).toHaveBeenCalledWith({
      projectId: 'test-project-id',
    });
    expect(token).toBe('ExponentPushToken[abc]');
  });

  it('devuelve null si getExpoPushTokenAsync falla', async () => {
    (Notifications.getExpoPushTokenAsync as jest.Mock).mockRejectedValueOnce(new Error('fail'));

    const token = await getExpoPushToken();

    expect(token).toBeNull();
  });
});

describe('registerPushToken', () => {
  it('registra el token vía RPC y lo cachea en AsyncStorage', async () => {
    mockedRpc.mockResolvedValueOnce({ error: null });
    Platform.OS = 'ios';

    await registerPushToken('token-1');

    expect(mockedRpc).toHaveBeenCalledWith('fn_register_push_token', {
      p_token: 'token-1',
      p_platform: 'ios',
      p_device_id: 'iPhone14,2',
    });
    await expect(AsyncStorage.getItem('matchmap_expo_push_token')).resolves.toBe('token-1');
  });

  it('lanza el error si la RPC falla y no cachea el token', async () => {
    mockedRpc.mockResolvedValueOnce({ error: { message: 'boom' } });

    await expect(registerPushToken('token-1')).rejects.toEqual({ message: 'boom' });
    await expect(AsyncStorage.getItem('matchmap_expo_push_token')).resolves.toBeNull();
  });
});

describe('unregisterCurrentPushToken', () => {
  it('no llama a la RPC si no hay token cacheado', async () => {
    await unregisterCurrentPushToken();

    expect(mockedRpc).not.toHaveBeenCalled();
  });

  it('desregistra el token cacheado y lo elimina de AsyncStorage', async () => {
    await AsyncStorage.setItem('matchmap_expo_push_token', 'token-1');
    mockedRpc.mockResolvedValueOnce({ error: null });

    await unregisterCurrentPushToken();

    expect(mockedRpc).toHaveBeenCalledWith('fn_unregister_push_token', { p_token: 'token-1' });
    await expect(AsyncStorage.getItem('matchmap_expo_push_token')).resolves.toBeNull();
  });

  it('no lanza si la RPC falla (falla en silencio)', async () => {
    await AsyncStorage.setItem('matchmap_expo_push_token', 'token-1');
    mockedRpc.mockResolvedValueOnce({ error: { message: 'boom' } });

    await expect(unregisterCurrentPushToken()).resolves.toBeUndefined();
  });
});

describe('requestMatchNotificationsPermission', () => {
  it('devuelve "skipped" si el dispositivo no es físico', async () => {
    (Device as any).isDevice = false;

    const result = await requestMatchNotificationsPermission('user-1');

    expect(result).toBe('skipped');
  });

  it('pide permiso solo si el estado es "undetermined" y registra el token si se concede', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({
      status: 'undetermined',
    });
    (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValueOnce({
      status: 'granted',
    });
    (Notifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValueOnce({
      data: 'ExponentPushToken[abc]',
    });
    mockedRpc.mockResolvedValueOnce({ error: null });

    const result = await requestMatchNotificationsPermission('user-1');

    expect(Notifications.requestPermissionsAsync).toHaveBeenCalled();
    expect(mockedRpc).toHaveBeenCalledWith(
      'fn_register_push_token',
      expect.objectContaining({ p_token: 'ExponentPushToken[abc]' })
    );
    expect(result).toBe('granted');
  });

  it('no vuelve a pedir permiso si ya estaba concedido, y registra el token', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'granted' });
    (Notifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValueOnce({
      data: 'ExponentPushToken[abc]',
    });
    mockedRpc.mockResolvedValueOnce({ error: null });

    const result = await requestMatchNotificationsPermission('user-1');

    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(result).toBe('granted');
  });

  it('devuelve "denied" si el usuario deniega el permiso', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({
      status: 'undetermined',
    });
    (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValueOnce({
      status: 'denied',
    });

    const result = await requestMatchNotificationsPermission('user-1');

    expect(result).toBe('denied');
    expect(mockedRpc).not.toHaveBeenCalled();
  });

  it('devuelve "skipped" si ocurre un error inesperado', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockRejectedValueOnce(new Error('boom'));

    const result = await requestMatchNotificationsPermission('user-1');

    expect(result).toBe('skipped');
  });
});

describe('fetchMatchNotificationsEnabled', () => {
  it('devuelve la preferencia guardada', async () => {
    mockedFrom.mockReturnValueOnce(
      createQueryBuilderMock({ data: { match_notifications_enabled: false }, error: null })
    );

    const result = await fetchMatchNotificationsEnabled('user-1');

    expect(result).toBe(false);
  });

  it('devuelve true por defecto si el campo es null', async () => {
    mockedFrom.mockReturnValueOnce(
      createQueryBuilderMock({ data: { match_notifications_enabled: null }, error: null })
    );

    const result = await fetchMatchNotificationsEnabled('user-1');

    expect(result).toBe(true);
  });

  it('lanza el error si Supabase falla', async () => {
    mockedFrom.mockReturnValueOnce(
      createQueryBuilderMock({ data: null, error: { message: 'boom' } })
    );

    await expect(fetchMatchNotificationsEnabled('user-1')).rejects.toEqual({ message: 'boom' });
  });
});

describe('setMatchNotificationsEnabled', () => {
  it('actualiza la preferencia del usuario', async () => {
    const builder = createQueryBuilderMock({ data: null, error: null });
    mockedFrom.mockReturnValueOnce(builder);

    await setMatchNotificationsEnabled('user-1', false);

    expect(builder.update).toHaveBeenCalledWith({ match_notifications_enabled: false });
    expect(builder.eq).toHaveBeenCalledWith('id', 'user-1');
  });

  it('lanza el error si Supabase falla', async () => {
    mockedFrom.mockReturnValueOnce(
      createQueryBuilderMock({ data: null, error: { message: 'boom' } })
    );

    await expect(setMatchNotificationsEnabled('user-1', true)).rejects.toEqual({
      message: 'boom',
    });
  });
});
