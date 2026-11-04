import React from 'react';
import { Text } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import { AdminOnly, withAdminOnly } from '~/components/AdminOnly';
import { useIsAdmin } from '~/hooks/useIsAdmin';

jest.mock('~/hooks/useIsAdmin', () => ({ useIsAdmin: jest.fn() }));
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return { SafeAreaView: View };
});

const mockedUseIsAdmin = useIsAdmin as jest.Mock;

describe('AdminOnly', () => {
  beforeEach(() => jest.clearAllMocks());

  it('no monta la pantalla mientras comprueba el rol', async () => {
    mockedUseIsAdmin.mockReturnValue({ isAdmin: false, loading: true });
    const { queryByText } = await render(<AdminOnly><Text>secreto</Text></AdminOnly>);
    expect(queryByText('secreto')).toBeNull();
  });

  it('bloquea a un usuario normal y deja volver', async () => {
    mockedUseIsAdmin.mockReturnValue({ isAdmin: false, loading: false });
    const { queryByText, getByText } = await render(<AdminOnly><Text>secreto</Text></AdminOnly>);
    expect(queryByText('secreto')).toBeNull();
    fireEvent.press(getByText('Volver'));
    expect(useRouter().back).toHaveBeenCalled();
  });

  it('muestra la pantalla al super admin', async () => {
    mockedUseIsAdmin.mockReturnValue({ isAdmin: true, loading: false });
    const Guarded = withAdminOnly(() => <Text>secreto</Text>);
    const { getByText } = await render(<Guarded />);
    expect(getByText('secreto')).toBeTruthy();
  });
});
