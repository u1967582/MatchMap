import { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PurchasesPackage, PurchasesOffering } from 'react-native-purchases';
import * as RevenueCatService from '~/utils/revenuecat';
import { AppText, toast } from '~/components/ds';
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

export default function Paywall({
  visible,
  onClose,
  onPurchaseComplete,
  barId,
  title = 'Impulsa tu bar',
  subtitle = 'Aumenta la visibilidad y atrae más clientes',
}: PaywallProps) {
  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<PurchasesPackage | null>(null);
  // Evita que onRequestClose tanci el modal automàticament a Android mentre carrega
  const isReadyToCloseRef = useRef(false);

  useEffect(() => {
    if (visible) {
      isReadyToCloseRef.current = false;
      loadOffering();
    } else {
      isReadyToCloseRef.current = false;
    }
  }, [visible]);

  const loadOffering = async () => {
    try {
      setLoading(true);
      console.log('[Paywall] Iniciant getOfferings...');
      const currentOffering = await RevenueCatService.getOfferings();
      console.log('[Paywall] getOfferings resposta:', currentOffering ? `${currentOffering.availablePackages.length} paquets` : 'null');
      setOffering(currentOffering);

      // Auto-select the first package if available
      if (currentOffering?.availablePackages.length) {
        setSelectedPackage(currentOffering.availablePackages[0]);
      }
    } catch (error) {
      console.error('[Paywall] Error getOfferings:', error);
      toast.error('No se pudieron cargar los productos', 'Inténtalo de nuevo');
    } finally {
      setLoading(false);
      // Ara sí es pot tancar manualment
      isReadyToCloseRef.current = true;
      console.log('[Paywall] Carregat, ara onRequestClose està habilitat');
    }
  };

  const handlePurchase = async () => {
    if (!selectedPackage) {
      toast.warning('Selecciona un plan primero');
      return;
    }

    try {
      setPurchasing(true);
      const { transaction } = await RevenueCatService.purchasePackage(selectedPackage);

      // Registrar boost en Supabase si tenemos barId
      if (barId) {
        const { data: { user } } = await supabase.auth.getUser();
        const plan = getPlanFromProductId(selectedPackage.product.identifier);
        if (plan && user) {
          const endAt = getEndAt(plan);
          const amountCents = Math.round(selectedPackage.product.price * 100);
          const currency = (selectedPackage.product.currencyCode ?? 'eur').toLowerCase();

          const { error: insertError } = await supabase
            .from('bar_boosts')
            .insert({
              bar_id: barId,
              user_id: user.id,
              plan,
              start_at: new Date().toISOString(),
              end_at: endAt.toISOString(),
              status: 'active',
              amount_cents: amountCents,
              currency,
              revenuecat_transaction_id: transaction?.transactionIdentifier ?? null,
            });

          if (insertError) {
            console.error('[Paywall] Error inserting bar_boost:', insertError);
            toast.warning('Boost comprado, pero no se pudo registrar. Contacta con soporte.');
          }
        }
      }

      onPurchaseComplete?.();
      onClose();
      toast.success('¡Compra exitosa!', 'Tu boost ha sido activado');
    } catch (error: any) {
      if (!error.userCancelled) {
        // Error crítico de pago - usar Alert
        Alert.alert(
          'Error en la compra',
          'No se pudo completar la compra. Por favor, inténtalo de nuevo.'
        );
      } else {
        // Usuario canceló - usar toast
        toast.info('Pago cancelado');
      }
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    try {
      setPurchasing(true);
      await RevenueCatService.restorePurchases();
      toast.success('Compras restauradas');
      onPurchaseComplete?.();
      onClose();
    } catch (error) {
      toast.error('No se pudieron restaurar las compras', 'Asegúrate de haber realizado compras previamente');
    } finally {
      setPurchasing(false);
    }
  };

  const formatPrice = (pkg: PurchasesPackage): string => {
    return pkg.product.priceString;
  };

  const getPackageTitle = (pkg: PurchasesPackage): string => {
    // Use package identifier or product title
    return pkg.product.title || pkg.identifier;
  };

  const getPackageDescription = (pkg: PurchasesPackage): string => {
    return pkg.product.description || 'Visibilidad premium para tu bar';
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      // statusBarTranslucent necessari a Android per evitar tancament automàtic
      statusBarTranslucent={Platform.OS === 'android'}
      onRequestClose={() => {
        // A Android, onRequestClose es pot disparar sol (back gesture, focus change)
        // Només tanquem si la càrrega ha acabat i l'usuari prem back conscientment
        if (isReadyToCloseRef.current) {
          console.log('[Paywall] onRequestClose cridat (Android back button)');
          onClose();
        } else {
          console.log('[Paywall] onRequestClose ignorat (encara carregant)');
        }
      }}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTextContainer}>
              <AppText style={styles.title}>{title}</AppText>
              <AppText style={styles.subtitle}>{subtitle}</AppText>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#A3B3CC" />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#1976D2" />
              <AppText style={styles.loadingText}>Cargando productos...</AppText>
            </View>
          ) : !offering || offering.availablePackages.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="cloud-offline-outline" size={48} color="#A3B3CC" />
              <AppText style={styles.emptyTitle}>No se pudieron cargar los planes</AppText>
              <AppText style={styles.emptyDescription}>
                Verifica tu conexión e inténtalo de nuevo
              </AppText>
              <TouchableOpacity style={styles.retryButton} onPress={loadOffering}>
                <AppText style={styles.retryButtonText}>Reintentar</AppText>
              </TouchableOpacity>
              <TouchableOpacity style={styles.closeLinkButton} onPress={onClose}>
                <AppText style={styles.closeLinkText}>Cerrar</AppText>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Benefits */}
              <View style={styles.benefitsSection}>
                <View style={styles.benefitItem}>
                  <View style={styles.benefitIcon}>
                    <Ionicons name="arrow-up-circle" size={20} color="#10B981" />
                  </View>
                  <View style={styles.benefitTextContainer}>
                    <AppText style={styles.benefitTitle}>Mayor visibilidad</AppText>
                    <AppText style={styles.benefitDescription}>
                      Tu bar aparece primero en búsquedas
                    </AppText>
                  </View>
                </View>

                <View style={styles.benefitItem}>
                  <View style={styles.benefitIcon}>
                    <Ionicons name="star" size={20} color="#FFD700" />
                  </View>
                  <View style={styles.benefitTextContainer}>
                    <AppText style={styles.benefitTitle}>Etiqueta destacado</AppText>
                    <AppText style={styles.benefitDescription}>
                      Badge especial que llama la atención
                    </AppText>
                  </View>
                </View>

                <View style={styles.benefitItem}>
                  <View style={styles.benefitIcon}>
                    <Ionicons name="trending-up" size={20} color="#60A5FA" />
                  </View>
                  <View style={styles.benefitTextContainer}>
                    <AppText style={styles.benefitTitle}>Prioridad en resultados</AppText>
                    <AppText style={styles.benefitDescription}>
                      Aparece antes que la competencia
                    </AppText>
                  </View>
                </View>
              </View>

              {/* Packages */}
              {offering.availablePackages.map((pkg) => (
                <TouchableOpacity
                  key={pkg.identifier}
                  style={[
                    styles.packageCard,
                    selectedPackage?.identifier === pkg.identifier &&
                      styles.packageCardSelected,
                  ]}
                  onPress={() => setSelectedPackage(pkg)}
                >
                  <View style={styles.packageHeader}>
                    <View style={styles.packageInfo}>
                      <AppText style={styles.packageTitle}>
                        {getPackageTitle(pkg)}
                      </AppText>
                      <AppText style={styles.packageDescription}>
                        {getPackageDescription(pkg)}
                      </AppText>
                    </View>
                    <View style={styles.packagePriceContainer}>
                      <AppText style={styles.packagePrice}>{formatPrice(pkg)}</AppText>
                      {selectedPackage?.identifier === pkg.identifier && (
                        <Ionicons name="checkmark-circle" size={24} color="#10B981" />
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              ))}

              {/* Purchase Button */}
              <TouchableOpacity
                style={[styles.purchaseButton, purchasing && styles.purchaseButtonDisabled]}
                onPress={handlePurchase}
                disabled={purchasing || !selectedPackage}
              >
                {purchasing ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <AppText style={styles.purchaseButtonText}>Comprar Ahora</AppText>
                )}
              </TouchableOpacity>

              {/* Restore Button */}
              <TouchableOpacity
                style={styles.restoreButton}
                onPress={handleRestore}
                disabled={purchasing}
              >
                <AppText style={styles.restoreButtonText}>Restaurar Compras</AppText>
              </TouchableOpacity>

              {/* Footer Info */}
              <AppText style={styles.footerText}>
                La compra se cargará a tu cuenta de Apple/Google. Puedes cancelar en cualquier momento.
              </AppText>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1C2A3A',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: 20,
    paddingBottom: 16,
  },
  headerTextContainer: {
    flex: 1,
    paddingRight: 16,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    color: '#A3B3CC',
    fontSize: 14,
    lineHeight: 20,
  },
  closeButton: {
    padding: 4,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    color: '#A3B3CC',
    fontSize: 14,
    marginTop: 16,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    gap: 12,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 8,
  },
  emptyDescription: {
    color: '#A3B3CC',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  retryButton: {
    backgroundColor: '#1976D2',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    marginTop: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  closeLinkButton: {
    paddingVertical: 8,
  },
  closeLinkText: {
    color: '#A3B3CC',
    fontSize: 14,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 0,
  },
  benefitsSection: {
    marginBottom: 24,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  benefitIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  benefitTextContainer: {
    flex: 1,
  },
  benefitTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  benefitDescription: {
    color: '#A3B3CC',
    fontSize: 13,
    lineHeight: 18,
  },
  packageCard: {
    backgroundColor: '#243243',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  packageCardSelected: {
    borderColor: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  packageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  packageInfo: {
    flex: 1,
    paddingRight: 12,
  },
  packageTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  packageDescription: {
    color: '#A3B3CC',
    fontSize: 13,
    lineHeight: 18,
  },
  packagePriceContainer: {
    alignItems: 'flex-end',
  },
  packagePrice: {
    color: '#10B981',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  purchaseButton: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 12,
  },
  purchaseButtonDisabled: {
    backgroundColor: '#6B7280',
  },
  purchaseButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  restoreButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  restoreButtonText: {
    color: '#1976D2',
    fontSize: 14,
    fontWeight: '600',
  },
  footerText: {
    color: '#6B7280',
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
    marginTop: 16,
  },
});
