import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSubscription } from '~/hooks/useSubscription';
import { CAP_BY_TIER } from '~/lib/planCapabilities';

interface SubscriptionStatusProps {
  barId: string;
  showUpgradeButton?: boolean;
}

const SubscriptionStatus: React.FC<SubscriptionStatusProps> = ({ 
  barId, 
  showUpgradeButton = true 
}) => {
  const router = useRouter();
  const { 
    subscription, 
    isLoading, 
    isPro, 
    isElite, 
    hasActiveSubscription,
    maxPhotosAllowed,
    canUseAutomation,
    canUseAdvancedStats,
    canUsePrioritySupport
  } = useSubscription(barId);

  const handleUpgrade = () => {
    router.push('/subscription-plans');
  };

  const getPlanName = () => {
    if (isElite) return 'Elite Bar';
    if (isPro) return 'Pro Bar';
    return 'Plan Gratuito';
  };

  const getPlanColor = () => {
    if (isElite) return '#FFD700'; // Gold
    if (isPro) return '#4CAF50'; // Green
    return '#A0AEC0'; // Gray
  };

  const getPlanIcon = () => {
    if (isElite) return 'diamond';
    if (isPro) return 'star';
    return 'pricetag-outline';
  };

  const getPlanSubtitle = () => {
    if (isElite) return 'Plan Premium';
    if (isPro) return 'Plan Estándar';
    return '';
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Cargando estado de suscripción...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.planInfo}>
          {getPlanSubtitle() && (
            <Text style={styles.planSubtitle}>{getPlanSubtitle()}</Text>
          )}
          <Text style={styles.planName}>{getPlanName()}</Text>
          {hasActiveSubscription && (
            <Text style={styles.planStatus}>
              Estado: Activo
            </Text>
          )}
        </View>
        
        {showUpgradeButton && !isElite && (
          <TouchableOpacity 
            style={styles.upgradeButton}
            onPress={handleUpgrade}
          >
            <Text style={styles.upgradeButtonText}>
              {hasActiveSubscription ? 'Mejorar' : 'Actualizar'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {hasActiveSubscription && (
        <View style={styles.featuresContainer}>
          <Text style={styles.featuresTitle}>Funciones incluidas:</Text>
          
          <View style={styles.featureRow}>
            <Ionicons name="images" size={14} color={getPlanColor()} />
            <Text style={styles.featureText}>
              Hasta {maxPhotosAllowed} fotos del bar
            </Text>
          </View>

          <View style={styles.featureRow}>
            <Ionicons name="calendar" size={14} color={getPlanColor()} />
            <Text style={styles.featureText}>
              {(isPro || isElite) ? 'Eventos ilimitados' : `Hasta ${CAP_BY_TIER.free.events_limit} evento${CAP_BY_TIER.free.events_limit === 1 ? '' : 's'} activo${CAP_BY_TIER.free.events_limit === 1 ? '' : 's'}`}
            </Text>
          </View>

          {(isPro || isElite) && (
            <View style={styles.featureRow}>
              <Ionicons name="checkmark-circle" size={14} color={getPlanColor()} />
              <Text style={styles.featureText}>Automatización de partidos</Text>
            </View>
          )}

          {canUsePrioritySupport && (
            <View style={styles.featureRow}>
              <Ionicons name="headset" size={14} color={getPlanColor()} />
              <Text style={styles.featureText}>Soporte prioritario</Text>
            </View>
          )}

          {canUseAdvancedStats && (
            <View style={styles.featureRow}>
              <Ionicons name="analytics" size={14} color={getPlanColor()} />
              <Text style={styles.featureText}>Estadísticas avanzadas</Text>
            </View>
          )}

          {canUseAutomation && (
            <View style={styles.featureRow}>
              <Ionicons name="settings" size={14} color={getPlanColor()} />
              <Text style={styles.featureText}>Automatización total</Text>
            </View>
          )}
        </View>
      )}

      {!hasActiveSubscription && (
        <View style={styles.upgradePrompt}>
          <Text style={styles.upgradePromptTitle}>
            🔒 Funciones premium bloqueadas
          </Text>
          <Text style={styles.upgradePromptText}>
            Actualiza tu plan para desbloquear:{"\n"}• Más imágenes en tu perfil{"\n"}• Ver la carta del bar{"\n"}• Destacar publicaciones{"\n"}• Búsqueda prioritaria
          </Text>
        </View>
      )}

      {subscription && hasActiveSubscription && (
        <View style={styles.subscriptionDetails}>
          <Text style={styles.detailsText}>
            Renovación: {new Date(subscription.end_date).toLocaleDateString('es-ES')}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1A2332',
    borderRadius: 16,
    padding: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  loadingText: {
    color: '#A3B3CC',
    fontSize: 13,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  planInfo: {
    flex: 1,
  },
  planSubtitle: {
    color: '#A3B3CC',
    fontSize: 10,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  planName: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 2,
  },
  planStatus: {
    color: '#A3B3CC',
    fontSize: 12,
  },
  upgradeButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    shadowColor: '#007AFF',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  upgradeButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  featuresContainer: {
    marginBottom: 16,
  },
  featuresTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  featureText: {
    color: '#E2E8F0',
    fontSize: 12,
    marginLeft: 8,
    flex: 1,
    lineHeight: 16,
  },
  upgradePrompt: {
    backgroundColor: '#2A3A4A',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  upgradePromptTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  upgradePromptText: {
    color: '#A3B3CC',
    fontSize: 12,
    lineHeight: 18,
  },
  subscriptionDetails: {
    borderTopWidth: 1,
    borderTopColor: '#4A5568',
    paddingTop: 12,
  },
  detailsText: {
    color: '#A3B3CC',
    fontSize: 11,
  },
});

export default SubscriptionStatus; 