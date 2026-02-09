import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PurchasesPackage, PurchasesOffering } from 'react-native-purchases';
import * as RevenueCatService from '~/utils/revenuecat';
import { toast } from '~/components/ds';

interface PaywallProps {
  visible: boolean;
  onClose: () => void;
  onPurchaseComplete?: () => void;
  title?: string;
  subtitle?: string;
}

export default function Paywall({
  visible,
  onClose,
  onPurchaseComplete,
  title = 'Impulsa tu bar',
  subtitle = 'Aumenta la visibilidad y atrae más clientes',
}: PaywallProps) {
  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<PurchasesPackage | null>(null);

  useEffect(() => {
    if (visible) {
      loadOffering();
    }
  }, [visible]);

  const loadOffering = async () => {
    try {
      setLoading(true);
      const currentOffering = await RevenueCatService.getOfferings();
      setOffering(currentOffering);

      // Auto-select the first package if available
      if (currentOffering?.availablePackages.length) {
        setSelectedPackage(currentOffering.availablePackages[0]);
      }
    } catch (error) {
      console.error('Failed to load offering:', error);
      toast.error('No se pudieron cargar los productos', 'Inténtalo de nuevo');
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async () => {
    if (!selectedPackage) {
      toast.warning('Selecciona un plan primero');
      return;
    }

    try {
      setPurchasing(true);
      await RevenueCatService.purchasePackage(selectedPackage);

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
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTextContainer}>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.subtitle}>{subtitle}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#A3B3CC" />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#1976D2" />
              <Text style={styles.loadingText}>Cargando productos...</Text>
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
                    <Text style={styles.benefitTitle}>Mayor visibilidad</Text>
                    <Text style={styles.benefitDescription}>
                      Tu bar aparece primero en búsquedas
                    </Text>
                  </View>
                </View>

                <View style={styles.benefitItem}>
                  <View style={styles.benefitIcon}>
                    <Ionicons name="star" size={20} color="#FFD700" />
                  </View>
                  <View style={styles.benefitTextContainer}>
                    <Text style={styles.benefitTitle}>Etiqueta destacado</Text>
                    <Text style={styles.benefitDescription}>
                      Badge especial que llama la atención
                    </Text>
                  </View>
                </View>

                <View style={styles.benefitItem}>
                  <View style={styles.benefitIcon}>
                    <Ionicons name="trending-up" size={20} color="#60A5FA" />
                  </View>
                  <View style={styles.benefitTextContainer}>
                    <Text style={styles.benefitTitle}>Prioridad en resultados</Text>
                    <Text style={styles.benefitDescription}>
                      Aparece antes que la competencia
                    </Text>
                  </View>
                </View>
              </View>

              {/* Packages */}
              {offering?.availablePackages.map((pkg) => (
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
                      <Text style={styles.packageTitle}>
                        {getPackageTitle(pkg)}
                      </Text>
                      <Text style={styles.packageDescription}>
                        {getPackageDescription(pkg)}
                      </Text>
                    </View>
                    <View style={styles.packagePriceContainer}>
                      <Text style={styles.packagePrice}>{formatPrice(pkg)}</Text>
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
                  <Text style={styles.purchaseButtonText}>Comprar Ahora</Text>
                )}
              </TouchableOpacity>

              {/* Restore Button */}
              <TouchableOpacity
                style={styles.restoreButton}
                onPress={handleRestore}
                disabled={purchasing}
              >
                <Text style={styles.restoreButtonText}>Restaurar Compras</Text>
              </TouchableOpacity>

              {/* Footer Info */}
              <Text style={styles.footerText}>
                La compra se cargará a tu cuenta de Apple/Google. Puedes cancelar en cualquier momento.
              </Text>
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
