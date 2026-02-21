import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { AppText } from '~/components/ds';
import { Ionicons } from '@expo/vector-icons';
import { CustomerInfo } from 'react-native-purchases';
import * as RevenueCatService from '~/utils/revenuecat';
import { useRevenueCat } from '~/contexts/RevenueCatContext';

interface CustomerCenterProps {
  visible: boolean;
  onClose: () => void;
}

export default function CustomerCenter({ visible, onClose }: CustomerCenterProps) {
  const { customerInfo, refreshCustomerInfo } = useRevenueCat();
  const [loading, setLoading] = useState(false);
  const [subscriptionInfo, setSubscriptionInfo] = useState<any>(null);

  useEffect(() => {
    if (visible && customerInfo) {
      loadSubscriptionInfo();
    }
  }, [visible, customerInfo]);

  const loadSubscriptionInfo = async () => {
    try {
      setLoading(true);
      const info = await RevenueCatService.getActiveSubscriptionInfo();
      setSubscriptionInfo(info);
    } catch (error) {
      console.error('Failed to load subscription info:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRestorePurchases = async () => {
    try {
      setLoading(true);
      await RevenueCatService.restorePurchases();
      await refreshCustomerInfo();
      Alert.alert(
        'Compras restauradas',
        'Tus compras anteriores han sido restauradas correctamente.'
      );
    } catch (error) {
      Alert.alert(
        'Error',
        'No se pudieron restaurar las compras. Asegúrate de haber realizado compras previamente.'
      );
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString?: string): string => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return 'N/A';
    }
  };

  const hasActiveSubscription = subscriptionInfo?.isActive || false;

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
            <AppText style={styles.title}>Centro de Cliente</AppText>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#A3B3CC" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#1976D2" />
              </View>
            ) : (
              <>
                {/* Subscription Status */}
                <View style={styles.section}>
                  <AppText style={styles.sectionTitle}>Estado de Suscripción</AppText>
                  <View style={styles.statusCard}>
                    <View style={styles.statusIconContainer}>
                      <Ionicons
                        name={hasActiveSubscription ? 'checkmark-circle' : 'alert-circle'}
                        size={32}
                        color={hasActiveSubscription ? '#10B981' : '#F59E0B'}
                      />
                    </View>
                    <View style={styles.statusInfo}>
                      <AppText style={styles.statusTitle}>
                        {hasActiveSubscription ? 'Suscripción Activa' : 'Sin Suscripción'}
                      </AppText>
                      <AppText style={styles.statusDescription}>
                        {hasActiveSubscription
                          ? 'Tu boost está activo y funcionando'
                          : 'No tienes ningún boost activo'}
                      </AppText>
                    </View>
                  </View>
                </View>

                {/* Subscription Details */}
                {hasActiveSubscription && subscriptionInfo && (
                  <View style={styles.section}>
                    <AppText style={styles.sectionTitle}>Detalles</AppText>
                    <View style={styles.detailsCard}>
                      {subscriptionInfo.productIdentifier && (
                        <View style={styles.detailRow}>
                          <AppText style={styles.detailLabel}>Producto</AppText>
                          <AppText style={styles.detailValue}>
                            {subscriptionInfo.productIdentifier}
                          </AppText>
                        </View>
                      )}

                      {subscriptionInfo.expirationDate && (
                        <View style={styles.detailRow}>
                          <AppText style={styles.detailLabel}>Expira</AppText>
                          <AppText style={styles.detailValue}>
                            {formatDate(subscriptionInfo.expirationDate)}
                          </AppText>
                        </View>
                      )}

                      <View style={styles.detailRow}>
                        <AppText style={styles.detailLabel}>Renovación automática</AppText>
                        <View style={styles.statusBadge}>
                          <                            style={[
                              styles.statusBadge                              subscriptionInfo.willRenew && styles.statusBadgeActive,
                            ]}
                          >
                            {subscriptionInfo.willRenew ? 'Activa' : 'Desactivada'}
                          </AppText>
                        </View>
                      </View>
                    </View>
                  </View>
                )}

                {/* Active Entitlements */}
                {customerInfo && Object.keys(customerInfo.entitlements.active).length > 0 && (
                  <View style={styles.section}>
                    <AppText style={styles.sectionTitle}>Funciones Activas</AppText>
                    <View style={styles.entitlementsCard}>
                      {Object.entries(customerInfo.entitlements.active).map(
                        ([key, entitlement]: [string, any]) => (
                          <View key={key} style={styles.entitlementItem}>
                            <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                            <AppText style={styles.entitlementText}>{key}</AppText>
                          </View>
                        )
                      )}
                    </View>
                  </View>
                )}

                {/* Actions */}
                <View style={styles.section}>
                  <AppText style={styles.sectionTitle}>Acciones</AppText>

                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={handleRestorePurchases}
                    disabled={loading}
                  >
                    <Ionicons name="refresh-circle-outline" size={24} color="#1976D2" />
                    <AppText style={styles.actionButtonText}>Restaurar Compras</AppText>
                    <Ionicons name="chevron-forward" size={20} color="#A3B3CC" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => {
                      Alert.alert(
                        'Gestionar Suscripción',
                        'Para gestionar tu suscripción, ve a la configuración de tu cuenta de Apple o Google Play.',
                        [{ text: 'OK' }]
                      );
                    }}
                  >
                    <Ionicons name="settings-outline" size={24} color="#1976D2" />
                    <AppText style={styles.actionButtonText}>Gestionar Suscripción</AppText>
                    <Ionicons name="chevron-forward" size={20} color="#A3B3CC" />
                  </TouchableOpacity>
                </View>

                {/* Help Section */}
                <View style={styles.section}>
                  <AppText style={styles.sectionTitle}>Ayuda</AppText>
                  <AppText style={styles.helpText}>
                    ¿Necesitas ayuda con tu suscripción? Contacta con nuestro equipo de soporte.
                  </AppText>
                  <TouchableOpacity
                    style={styles.supportButton}
                    onPress={() => {
                      Alert.alert(
                        'Soporte',
                        'Próximamente: sistema de soporte integrado',
                        [{ text: 'OK' }]
                      );
                    }}
                  >
                    <AppText style={styles.supportButtonText}>Contactar Soporte</AppText>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </ScrollView>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
  },
  closeButton: {
    padding: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#243243',
    borderRadius: 12,
    padding: 16,
  },
  statusIconContainer: {
    marginRight: 16,
  },
  statusInfo: {
    flex: 1,
  },
  statusTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  statusDescription: {
    color: '#A3B3CC',
    fontSize: 13,
    lineHeight: 18,
  },
  detailsCard: {
    backgroundColor: '#243243',
    borderRadius: 12,
    padding: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  detailLabel: {
    color: '#A3B3CC',
    fontSize: 14,
    fontWeight: '500',
  },
  detailValue: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(249, 115, 22, 0.2)',
  },
  statusBadgeText: {
    color: '#F97316',
    fontSize: 12,
    fontWeight: '600',
  },
  statusBadgeActive: {
    color: '#10B981',
  },
  entitlementsCard: {
    backgroundColor: '#243243',
    borderRadius: 12,
    padding: 16,
  },
  entitlementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  entitlementText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#243243',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  actionButtonText: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 12,
  },
  helpText: {
    color: '#A3B3CC',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  supportButton: {
    backgroundColor: '#1976D2',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  supportButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
