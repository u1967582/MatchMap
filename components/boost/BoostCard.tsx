import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
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
  return (
    <View style={[styles.card, isPopular && styles.cardPopular]}>
      {isPopular && (
        <View style={styles.popularBadge}>
          <Ionicons name="star" size={14} color="#FFFFFF" />
          <AppText maxScale={1.0} style={styles.popularText}>Más Popular</AppText>
        </View>
      )}
      
      <View style={styles.headerRow}>
        <View style={styles.titleRow}>
          <Ionicons name={iconName} size={20} color={isPopular ? "#D4AF37" : "#60A5FA"} />
          <AppText maxScale={1.1} style={styles.title}>{title}</AppText>
        </View>
        {discountBadge && !isPopular ? (
          <View style={styles.badge}><AppText maxScale={1.0} style={styles.badgeText}>{discountBadge}</AppText></View>
        ) : null}
      </View>

      <AppText maxScale={1.1} style={[styles.price, isPopular && styles.pricePopular]}>{price}</AppText>
      <AppText style={styles.duration}>{durationLabel}</AppText>

      {/* Amortization info */}
      <View style={styles.amortizationBox}>
        <Ionicons name="trending-up-outline" size={16} color="#10B981" />
        <AppText style={styles.amortizationText}>{amortizationText}</AppText>
      </View>

      <View style={styles.valueInfo}>
        <Ionicons name="information-circle-outline" size={13} color="#60A5FA" />
        <AppText maxScale={1.3} style={styles.valueText}>
          Cada nuevo cliente te genera ~13€ de beneficio medio
        </AppText>
      </View>

      <TouchableOpacity activeOpacity={0.9} onPress={onPay} style={styles.ctaWrapper}>
        <Gradient
          colors={isPopular ? ["#D4AF37", "#B8956A"] : ["#3B82F6", "#10B981"]}
          start={{x:0,y:0}}
          end={{x:1,y:1}}
          style={styles.cta}
        >
          <Ionicons name="card-outline" size={17} color="#FFFFFF" />
          <AppText maxScale={1.0} style={styles.ctaText}>Pagar con Tarjeta</AppText>
        </Gradient>
      </TouchableOpacity>
      {footer ? <View style={{ marginTop: 10, alignItems: 'center' }}>{footer}</View> : null}
    </View>
  );
};

export default BoostCard;

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1A2332',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#2A3A4A',
    position: 'relative'
  },
  cardPopular: {
    borderColor: '#D4AF37',
    backgroundColor: 'rgba(212, 175, 55, 0.05)',
    shadowColor: '#D4AF37',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
  },
  popularBadge: {
    position: 'absolute',
    top: -8,
    right: 16,
    backgroundColor: '#D4AF37',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 16,
    shadowColor: '#D4AF37',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  popularText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  title: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700'
  },
  badge: {
    backgroundColor: '#10B981',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700'
  },
  price: {
    color: '#60A5FA',
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 2,
  },
  pricePopular: {
    color: '#D4AF37',
  },
  duration: {
    color: '#A3B3CC',
    fontSize: 13,
    marginBottom: 12
  },
  amortizationBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    marginBottom: 8,
  },
  amortizationText: {
    color: '#10B981',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  valueInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginBottom: 6,
  },
  valueText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 11,
    flex: 1,
    fontStyle: 'italic',
  },
  ctaWrapper: {
    marginTop: 6
  },
  cta: {
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700'
  }
});


