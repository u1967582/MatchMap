import { usePendingNotificationStore } from '~/stores/pendingNotificationStore';

beforeEach(() => usePendingNotificationStore.setState({ matchId: null, handledIds: [] }));

describe('pendingNotificationStore', () => {
  it('registerTap guarda el partido pendiente', () => {
    expect(usePendingNotificationStore.getState().registerTap('n1', 'm1')).toBe(true);
    expect(usePendingNotificationStore.getState().matchId).toBe('m1');
  });

  it('la misma notificación solo se trata una vez (listener + respuesta en frío)', () => {
    const { registerTap } = usePendingNotificationStore.getState();
    expect(registerTap('n1', 'm1')).toBe(true);
    expect(registerTap('n1', 'm1')).toBe(false);
  });

  it('otra notificación sustituye el partido pendiente', () => {
    const { registerTap } = usePendingNotificationStore.getState();
    registerTap('n1', 'm1');
    expect(registerTap('n2', 'm2')).toBe(true);
    expect(usePendingNotificationStore.getState().matchId).toBe('m2');
  });

  it('clear olvida el partido pero recuerda las notificaciones tratadas', () => {
    const { registerTap, clear } = usePendingNotificationStore.getState();
    registerTap('n1', 'm1');
    clear();
    expect(usePendingNotificationStore.getState().matchId).toBeNull();
    expect(usePendingNotificationStore.getState().registerTap('n1', 'm1')).toBe(false);
  });

  it('limita los identificadores recordados', () => {
    const { registerTap } = usePendingNotificationStore.getState();
    for (let i = 0; i < 30; i++) registerTap(`n${i}`, 'm');
    expect(usePendingNotificationStore.getState().handledIds).toHaveLength(20);
    expect(usePendingNotificationStore.getState().registerTap('n0', 'm')).toBe(true);
  });
});
