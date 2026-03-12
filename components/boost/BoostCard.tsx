import React from 'react';
import { View, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { AppText } from '~/components/ds';
import { Ionicons } from '@expo/vector-icons';
import Gradient from '~/components/ui/Gradient';

export interface BoostCardProps {
  title: string;
  price: string;
  productId: string;
  durationLabel: string;
  amortizationText: string;
  isPopular?: boolean;
  discountBadge?: string;
  onPay: () => void;
  iconName?: keyof typeof Ionicons.glyphMap;
  footer?: React.ReactNode;
}

const POPULAR_COLOR = '#22D3EE';
const POPULAR_GRADIENT: [string, string] = ['#06B6D4', '#0891B2'];

const BoostCard: React.FC<BoostCardProps> = ({
  title,
  price,
  discountBadge,
  durationLabel,
  amortizationText,
  isPopular,
  onPay,
  iconName = 'megaphone',
  footer
}) => {
  const accentColor = isPopular ? POPULAR_COLOR : '#60A5FA';

  return (
    <View style={[styles.cardOuter, isPopular && styles.cardOuterPopular]}>
      {isPopular && (
        <View style={styles.popularBadge}>
          <Ionicons name="star" size={11} color="#FFFFFF" />
          <AppText maxScale={1.0} style={styles.popularText}>MÁS POPULAR</AppText>
        </View>
      )}
      <View style={[styles.card, isPopular && styles.cardPopular]}>

      {/* Título + badge descuento */}
      <View style={styles.headerRow}>
        <View style={styles.titleRow}>
          <Ionicons name={iconName} size={18} color={accentColor} />
          <AppText maxScale={1.0} style={styles.title}>{title}</AppText>
        </View>
        {discountBadge && !isPopular && (
          <View style={styles.badge}>
            <AppText maxScale={1.0} style={styles.badgeText}>{discountBadge}</AppText>
          </View>
        )}
      </View>

      {/* Precio + duración en línea */}
      <View style={styles.priceRow}>
        <AppText maxScale={1.0} style={[styles.price, { color: accentColor }]}>{price}</AppText>
        <AppText maxScale={1.0} style={styles.duration}>{durationLabel}</AppText>
      </View>

      {/* Amortización */}
      <View style={styles.amortizationBox}>
        <Ionicons name="trending-up-outline" size={14} color="#10B981" />
        <AppText maxScale={1.0} style={styles.amortizationText}>{amortizationText}</AppText>
      </View>

      {/* Nota valor */}
      <View style={styles.valueInfo}>
        <Ionicons name="information-circle-outline" size={12} color="rgba(255,255,255,0.35)" />
        <AppText maxScale={1.0} style={styles.valueText}>
          Cada cliente nuevo genera ~13€ de beneficio medio
        </AppText>
      </View>

      <TouchableOpacity activeOpacity={0.9} onPress={onPay} style={styles.ctaWrapper}>
        <Gradient
          colors={isPopular ? POPULAR_GRADIENT : ['#3B82F6', '#1D4ED8']}
          start={{x:0,y:0}}
          end={{x:1,y:0}}
          style={styles.cta}
        >
          <Ionicons name="card-outline" size={16} color="#FFFFFF" />
          <AppText maxScale={1.0} style={styles.ctaText}>Pagar con Tarjeta</AppText>
        </Gradient>
      </TouchableOpacity>
      {footer ? <View style={{ marginTop: 8, alignItems: 'center' }}>{footer}</View> : null}
      </View>
    </View>
  );
};

export default BoostCard;

const styles = StyleSheet.create({
  cardOuter: {
    marginBottom: 10,
  },
  cardOuterPopular: {
    paddingTop: 13,
    marginTop: 4,
  },
  card: {
    backgroundColor: '#1A2332',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#2A3A4A',
  },
  cardPopular: {
    borderColor: '#06B6D4',
    backgroundColor: 'rgba(6, 182, 212, 0.06)',
    ...Platform.select({
      ios: {
        shadowColor: '#06B6D4',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.18,
        shadowRadius: 16,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  popularBadge: {
    position: 'absolute',
    top: 0,
    right: 12,
    zIndex: 10,
    backgroundColor: '#06B6D4',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: 20,
  },
  popularText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  badge: {
    backgroundColor: '#10B981',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginBottom: 8,
  },
  price: {
    fontSize: 26,
    fontWeight: '800',
    lineHeight: 32,
  },
  duration: {
    color: '#7A8FA6',
    fontSize: 13,
    fontWeight: '500',
  },
  amortizationBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginBottom: 6,
  },
  amortizationText: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  valueInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  valueText: {
    color: 'rgba(255, 255, 255, 0.35)',
    fontSize: 11,
    flex: 1,
    fontStyle: 'italic',
  },
  ctaWrapper: {
    marginTop: 2,
  },
  cta: {
    height: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});


