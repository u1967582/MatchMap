import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import AppErrorFallback from '~/components/AppErrorFallback';
import { reportError } from '~/utils/errorReporting';

jest.mock('~/utils/errorReporting', () => ({
  reportError: jest.fn(),
}));

const mockedReportError = reportError as jest.Mock;

describe('AppErrorFallback', () => {
  beforeEach(() => {
    mockedReportError.mockClear();
  });

  it('muestra la pantalla de error con botón de reintentar', async () => {
    const { getByText, getByTestId } = await render(
      <AppErrorFallback error={new Error('boom')} retry={jest.fn()} />
    );

    expect(getByTestId('app-error-fallback')).toBeTruthy();
    expect(getByText('Algo ha fallado')).toBeTruthy();
    expect(getByText('Reintentar')).toBeTruthy();
  });

  it('reporta el error una sola vez como origen boundary', async () => {
    const error = new Error('boom');
    const { rerender } = await render(<AppErrorFallback error={error} retry={jest.fn()} />);
    await rerender(<AppErrorFallback error={error} retry={jest.fn()} />);

    expect(mockedReportError).toHaveBeenCalledTimes(1);
    expect(mockedReportError).toHaveBeenCalledWith(error, { source: 'boundary' });
  });

  it('llama a retry al pulsar Reintentar', async () => {
    const retry = jest.fn().mockResolvedValue(undefined);
    const { getByText } = await render(
      <AppErrorFallback error={new Error('boom')} retry={retry} />
    );

    await fireEvent.press(getByText('Reintentar'));

    expect(retry).toHaveBeenCalledTimes(1);
  });
});
