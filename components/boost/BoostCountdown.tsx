import React from 'react';
import { View, StyleSheet } from 'react-native';
import { AppText } from '~/components/ds';
import { Ionicons } from '@expo/vector-icons';
import { useCountdown, formatCountdown } from '~/hooks/useCountdown';

interface BoostCountdownProps {
  endAt: string | Date;
  style?: any;
}

/**
 * Displays a countdown timer for active boost
 */
const BoostCountdown: React.FC<BoostCountdownProps> = ({ endAt, style }) => {
  const countdown = useCountdown(endAt);

  // Don't render if expired
  if (countdown.expired) {
    return null;
  }

  const formattedTime = formatCountdown(countdown);

  return (
    <View style={[styles.container, style]}>
      <View style={styles.content}>
        <Ionicons name="flash" size={16} color="#FFD700" />
        <AppText maxScale={1.0} style={styles.label}>Boost activo:</AppText>
        <AppText maxScale={1.0} style={styles.time}>{formattedTime}</AppText>
      </View>
    </View>
  );
};

export default BoostCountdown;

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 12,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  label: {
    color: '#FFD700',
    fontSize: 13,
    fontWeight: '600',
  },
  time: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
});
