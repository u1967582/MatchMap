import { useEffect, useRef, useState } from 'react';
import { Modal, Platform, StyleSheet, View } from 'react-native';
import RevenueCatUI from 'react-native-purchases-ui';
import { PurchasesOffering, PurchasesPackage } from 'react-native-purchases';
import * as RevenueCatService from '~/utils/revenuecat';
import { toast } from '~/components/ds';
import { supabase } from '~/utils/supabase';

function getPlanFromProductId(productId: string): '7d' | '1m' | '1y' | null {
  if (productId.includes('boost_7d')) return '7d';
  if (productId.includes('boost_1m')) return '1m';
  if (productId.includes('boost_1y')) return '1y';
  return null;
}

function getEndAt(plan: '7d' | '1m' | '1y'): Date {
  const end = new Date();
  if (plan === '7d') end.setDate(end.getDate() + 7);
  else if (plan === '1m') end.setMonth(end.getMonth() + 1);
  else end.setFullYear(end.getFullYear() + 1);
  return end;
}

interface PaywallProps {
  visible: boolean;
  onClose: () => void;
  onPurchaseComplete?: () => void;
  barId?: string;
  title?: string;
  subtitle?: string;
}

export default function Paywall({ visible, onClose, onPurchaseComplete, barId }: PaywallProps) {
  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  const pendingPackageRef = useRef<PurchasesPackage | null>(null);

  useEffect(() => {
    if (visible) {
      RevenueCatService.getOfferings().then((o) => {
        console.log('[Paywall] offering received:', o?.identifier ?? 'null');
        if (o) {
          setOffering(o);
        }
      });
    } else {
      setOffering(null);
      pendingPackageRef.current = null;
    }
  }, [visible]);

  const handlePurchaseCompleted = async ({
    storeTransaction,
  }: {
    storeTransaction: { transactionIdentifier: string };
    customerInfo: unknown;
  }) => {
    if (barId && pendingPackageRef.current) {
      const pkg = pendingPackageRef.current;
      const plan = getPlanFromProductId(pkg.product.identifier);
      if (plan) {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          const endAt = getEndAt(plan);
          const { error: insertError } = await supabase.from('bar_boosts').insert({
            bar_id: barId,
            user_id: user.id,
            plan,
            start_at: new Date().toISOString(),
            end_at: endAt.toISOString(),
            status: 'active',
            amount_cents: Math.round(pkg.product.price * 100),
            currency: (pkg.product.currencyCode ?? 'eur').toLowerCase(),
            revenuecat_transaction_id: storeTransaction.transactionIdentifier ?? null,
          });
          if (insertError) {
            console.error('[Paywall] Error inserting bar_boost:', insertError);
            toast.warning('Boost comprado, pero no se pudo registrar. Contacta con soporte.');
          }
        }
      }
    }
    toast.success('¡Compra exitosa!', 'Tu boost ha sido activado');
    onPurchaseComplete?.();
    onClose();
  };

  const handleRestoreCompleted = () => {
    toast.success('Compras restauradas');
    onPurchaseComplete?.();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      statusBarTranslucent={Platform.OS === 'android'}
      onRequestClose={onClose}>
      <View style={styles.container}>
        {offering && (
          <RevenueCatUI.Paywall
            style={styles.paywall}
            options={{ offering, displayCloseButton: true }}
            onPurchaseStarted={({ packageBeingPurchased }) => {
              pendingPackageRef.current = packageBeingPurchased;
            }}
            onPurchaseCompleted={handlePurchaseCompleted}
            onPurchaseCancelled={onClose}
            onPurchaseError={({ error }: { error: { message: string } }) =>
              toast.error('Error al comprar', error.message)
            }
            onDismiss={onClose}
            onRestoreCompleted={handleRestoreCompleted}
            onRestoreError={({ error }: { error: { message: string } }) =>
              toast.error('No se pudieron restaurar las compras', error.message)
            }
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  paywall: {
    flex: 1,
  },
});
