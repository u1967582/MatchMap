import { create } from 'zustand';

/**
 * Partido pendiente de abrir tras tocar una notificación (auditoría 06-H5).
 *
 * Con la app cerrada, el toque llega mientras `app/index.tsx` y el listener de
 * auth de `app/_layout.tsx` hacen `router.replace('/(protected)/map')` sin
 * parámetros. Si solo se pasara el `matchId` por la URL, según quién navegue el
 * último se perdería. Por eso se guarda aquí y `map.tsx` lo lee aunque su ruta
 * no lo traiga.
 */
interface PendingNotificationState {
  matchId: string | null;
  /** Identificadores de notificaciones ya tratadas (listener y respuesta en frío). */
  handledIds: string[];
  /**
   * Registra el toque. Devuelve false si esa notificación ya se había tratado,
   * para no navegar dos veces.
   */
  registerTap: (notificationId: string, matchId: string) => boolean;
  clear: () => void;
}

const MAX_HANDLED_IDS = 20;

export const usePendingNotificationStore = create<PendingNotificationState>((set, get) => ({
  matchId: null,
  handledIds: [],
  registerTap: (notificationId, matchId) => {
    if (get().handledIds.includes(notificationId)) return false;
    set((state) => ({
      matchId,
      handledIds: [...state.handledIds, notificationId].slice(-MAX_HANDLED_IDS),
    }));
    return true;
  },
  clear: () => set({ matchId: null }),
}));
