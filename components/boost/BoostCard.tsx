import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Gradient from '~/components/ui/Gradient';

export interface BoostCardProps {
  title: string;
  price: string;
  productId: string;
  durationLabel: string;
  discountBadge?: string;
  onPay: () => void;
  iconName?: keyof typeof Ionicons.glyphMap;
  footer?: React.ReactNode;
}

const BoostCard: React.FC<BoostCardProps> = ({ title, price, discountBadge, durationLabel, onPay, iconName = 'megaphone', footer }) => {
  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.titleRow}>
          <Ionicons name={iconName} size={20} color="#60A5FA" />
          <Text style={styles.title}>{title}</Text>
        </View>
        {discountBadge ? (
          <View style={styles.badge}><Text style={styles.badgeText}>{discountBadge}</Text></View>
        ) : null}
      </View>

      <Text style={styles.price}>{price}</Text>
      <Text style={styles.duration}>{durationLabel}</Text>

      <TouchableOpacity activeOpacity={0.9} onPress={onPay} style={styles.ctaWrapper}>
        <Gradient colors={["#3B82F6", "#10B981"]} start={{x:0,y:0}} end={{x:1,y:1}} style={styles.cta}>
          <Ionicons name="card-outline" size={18} color="#FFFFFF" />
          <Text style={styles.ctaText}>Pagar con Stripe</Text>
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
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2A3A4A'
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  title: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600'
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
    fontSize: 28,
    fontWeight: '800'
  },
  duration: {
    color: '#A3B3CC',
    marginBottom: 12
  },
  ctaWrapper: {
    marginTop: 8
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


