import React, { createContext, useContext, useEffect, useState } from 'react';
import * as RevenueCatService from '~/utils/revenuecat';
import { supabase } from '~/utils/supabase';

interface RevenueCatContextType {
  isReady: boolean;
}

const RevenueCatContext = createContext<RevenueCatContextType | undefined>(undefined);

/**
 * Configura RevenueCat y mantiene su App User ID sincronizado con la sesión
 * de Supabase (login, logout y cambio de cuenta). Las sesiones anónimas
 * (invitado) no se identifican: un invitado no puede tener bar ni comprar.
 *
 * No bloquea el render: `configure` es síncrono y la sesión se lee de
 * almacenamiento local, así que la app arranca sin esperar a la red.
 */
export function RevenueCatProvider({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const initialize = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const user = session?.user;
        await RevenueCatService.initializeRevenueCat(user && !user.is_anonymous ? user.id : null);
      } catch (error) {
        // La app sigue funcionando sin RevenueCat; el paywall mostrará el error.
        console.error('[RevenueCat] Failed to initialize:', error);
      } finally {
        if (isMounted) setIsReady(true);
      }
    };

    initialize();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      const user = session?.user;
      // INITIAL_SESSION lo cubre initialize(); USER_UPDATED = invitado que se registra
      if ((event === 'SIGNED_IN' || event === 'USER_UPDATED') && user && !user.is_anonymous) {
        RevenueCatService.syncRevenueCatUser(user.id).catch((error) =>
          console.error('[RevenueCat] logIn failed:', error),
        );
      } else if (event === 'SIGNED_OUT') {
        RevenueCatService.logoutRevenueCatUser().catch((error) =>
          console.error('[RevenueCat] logOut failed:', error),
        );
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return <RevenueCatContext.Provider value={{ isReady }}>{children}</RevenueCatContext.Provider>;
}

export function useRevenueCat() {
  const context = useContext(RevenueCatContext);
  if (context === undefined) {
    throw new Error('useRevenueCat must be used within a RevenueCatProvider');
  }
  return context;
}
