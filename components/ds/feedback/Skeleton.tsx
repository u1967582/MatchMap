import { useEffect } from 'react';
import { ViewStyle, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { colors } from '../tokens/colors';
import { radius } from '../tokens/radius';
import { spacing } from '../tokens/spacing';
import { timings } from '../tokens/motion';

/* ─── SkeletonBox: bloque individual con pulse ─── */

interface SkeletonBoxProps {
  width: number | `${number}%`;
  height: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function SkeletonBox({
  width,
  height,
  borderRadius = radius.md,
  style,
}: SkeletonBoxProps) {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.7, timings.pulse),
      -1,
      true
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: colors.bg.elevated,
        },
        animatedStyle,
        style,
      ]}
    />
  );
}

/* ─── SkeletonCard: layout que replica una BarCard ─── */

export function SkeletonCard() {
  return (
    <Animated.View style={styles.card}>
      <SkeletonBox width="100%" height={180} borderRadius={0} />
      <Animated.View style={styles.cardBody}>
        <SkeletonBox width="60%" height={20} />
        <Animated.View style={styles.cardRow}>
          <SkeletonBox width={100} height={16} />
          <SkeletonBox width={60} height={16} />
        </Animated.View>
        <SkeletonBox width="80%" height={14} />
      </Animated.View>
    </Animated.View>
  );
}

/* ─── SkeletonList: N skeleton cards ─── */

interface SkeletonListProps {
  count?: number;
}

export function SkeletonList({ count = 3 }: SkeletonListProps) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bg.card,
    borderRadius: radius.xl,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  cardBody: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
