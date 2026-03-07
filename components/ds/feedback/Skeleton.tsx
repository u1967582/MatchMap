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

/* ─── ProfileSkeleton: skeleton para perfil de usuario ─── */

export function ProfileSkeleton() {
  return (
    <Animated.View style={styles.profileContainer}>
      {/* Avatar */}
      <Animated.View style={styles.avatarSection}>
        <SkeletonBox width={120} height={120} borderRadius={60} />
        <SkeletonBox width="60%" height={24} style={{ marginTop: spacing.lg }} />
        <SkeletonBox width="40%" height={16} style={{ marginTop: spacing.xs }} />
      </Animated.View>

      {/* Bar Card */}
      <Animated.View style={styles.sectionContainer}>
        <SkeletonBox width="40%" height={20} style={{ marginBottom: spacing.lg }} />
        <Animated.View style={styles.barCardSkeleton}>
          <SkeletonBox width={60} height={60} borderRadius={radius.sm} />
          <Animated.View style={styles.barCardContent}>
            <SkeletonBox width="70%" height={18} />
            <SkeletonBox width="50%" height={14} style={{ marginTop: spacing.sm }} />
          </Animated.View>
        </Animated.View>
      </Animated.View>

      {/* Settings Section */}
      <Animated.View style={styles.sectionContainer}>
        <SkeletonBox width="50%" height={20} style={{ marginBottom: spacing.lg }} />
        <Animated.View style={styles.settingsSkeleton}>
          <SkeletonBox width="100%" height={56} />
          <SkeletonBox width="100%" height={56} style={{ marginTop: spacing.xs }} />
          <SkeletonBox width="100%" height={56} style={{ marginTop: spacing.xs }} />
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

/* ─── MapSkeleton: skeleton para mapa con markers ─── */

export function MapSkeleton() {
  return (
    <Animated.View style={styles.mapSkeletonContainer}>
      {/* Map Area - Clean base */}
      <Animated.View style={styles.mapArea}>
        {/* Subtle grid lines to simulate streets */}
        <Animated.View style={[styles.mapGridLine, styles.mapGridLineHorizontal, { top: '30%' }]} />
        <Animated.View style={[styles.mapGridLine, styles.mapGridLineHorizontal, { top: '60%' }]} />
        <Animated.View style={[styles.mapGridLine, styles.mapGridLineVertical, { left: '35%' }]} />
        <Animated.View style={[styles.mapGridLine, styles.mapGridLineVertical, { left: '65%' }]} />

        {/* Bar markers scattered across the map */}
        <Animated.View style={[styles.mapMarker, { top: '18%', left: '22%' }]}>
          <SkeletonBox width={36} height={36} borderRadius={radius.round} />
        </Animated.View>
        <Animated.View style={[styles.mapMarker, { top: '28%', right: '28%' }]}>
          <SkeletonBox width={32} height={32} borderRadius={radius.round} />
        </Animated.View>
        <Animated.View style={[styles.mapMarker, { top: '45%', left: '18%' }]}>
          <SkeletonBox width={38} height={38} borderRadius={radius.round} />
        </Animated.View>
        <Animated.View style={[styles.mapMarker, { top: '55%', right: '22%' }]}>
          <SkeletonBox width={34} height={34} borderRadius={radius.round} />
        </Animated.View>
        <Animated.View style={[styles.mapMarker, { top: '70%', left: '38%' }]}>
          <SkeletonBox width={36} height={36} borderRadius={radius.round} />
        </Animated.View>
        <Animated.View style={[styles.mapMarker, { top: '32%', left: '65%' }]}>
          <SkeletonBox width={32} height={32} borderRadius={radius.round} />
        </Animated.View>
        <Animated.View style={[styles.mapMarker, { bottom: '25%', right: '35%' }]}>
          <SkeletonBox width={36} height={36} borderRadius={radius.round} />
        </Animated.View>
        <Animated.View style={[styles.mapMarker, { top: '60%', right: '48%' }]}>
          <SkeletonBox width={34} height={34} borderRadius={radius.round} />
        </Animated.View>
        <Animated.View style={[styles.mapMarker, { bottom: '38%', left: '42%' }]}>
          <SkeletonBox width={38} height={38} borderRadius={radius.round} />
        </Animated.View>
        <Animated.View style={[styles.mapMarker, { top: '15%', right: '15%' }]}>
          <SkeletonBox width={32} height={32} borderRadius={radius.round} />
        </Animated.View>
        <Animated.View style={[styles.mapMarker, { bottom: '15%', left: '28%' }]}>
          <SkeletonBox width={34} height={34} borderRadius={radius.round} />
        </Animated.View>
        <Animated.View style={[styles.mapMarker, { top: '38%', right: '55%' }]}>
          <SkeletonBox width={36} height={36} borderRadius={radius.round} />
        </Animated.View>

        {/* User location indicator in center */}
        <Animated.View style={styles.mapUserLocation}>
          <SkeletonBox width={24} height={24} borderRadius={radius.round} />
          <Animated.View style={styles.mapUserLocationRing} />
        </Animated.View>
      </Animated.View>

      {/* Top Controls - Exact replica of Map.tsx */}
      <Animated.View style={styles.mapTopControls}>
        {/* Search button - círculo 40x40 */}
        <Animated.View style={styles.mapButton}>
          <SkeletonBox width={40} height={40} borderRadius={20} />
        </Animated.View>
        {/* Match filter pill - flex: 1, height 44 */}
        <Animated.View style={[styles.mapButton, styles.mapButtonFlex]}>
          <SkeletonBox width="100%" height={44} borderRadius={22} />
        </Animated.View>
        {/* Filter button - círculo 40x40 */}
        <Animated.View style={styles.mapButton}>
          <SkeletonBox width={40} height={40} borderRadius={20} />
        </Animated.View>
      </Animated.View>

      {/* Center Location Button with shadow */}
      <Animated.View style={styles.mapCenterButton}>
        <Animated.View style={styles.mapButtonCircle}>
          <SkeletonBox width={56} height={56} borderRadius={28} />
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

/* ─── EditBarSkeleton: skeleton para editar info del bar ─── */

export function EditBarSkeleton() {
  return (
    <Animated.View style={styles.editBarContainer}>
      {/* Header con botones */}
      <Animated.View style={styles.editBarHeader}>
        <SkeletonBox width={40} height={40} borderRadius={20} />
        <SkeletonBox width="50%" height={24} />
        <SkeletonBox width={80} height={40} borderRadius={radius.md} />
      </Animated.View>

      {/* Bar Info */}
      <Animated.View style={styles.editBarInfo}>
        <SkeletonBox width="60%" height={20} />
        <SkeletonBox width="40%" height={14} style={{ marginTop: spacing.xs }} />
      </Animated.View>

      {/* Form Inputs */}
      <Animated.View style={styles.editBarForm}>
        {/* Input 1 */}
        <Animated.View style={styles.inputGroup}>
          <SkeletonBox width="30%" height={16} style={{ marginBottom: spacing.sm }} />
          <SkeletonBox width="100%" height={48} borderRadius={radius.md} />
        </Animated.View>

        {/* Input 2 */}
        <Animated.View style={styles.inputGroup}>
          <SkeletonBox width="40%" height={16} style={{ marginBottom: spacing.sm }} />
          <SkeletonBox width="100%" height={100} borderRadius={radius.md} />
        </Animated.View>

        {/* Input 3 */}
        <Animated.View style={styles.inputGroup}>
          <SkeletonBox width="35%" height={16} style={{ marginBottom: spacing.sm }} />
          <SkeletonBox width="100%" height={48} borderRadius={radius.md} />
        </Animated.View>

        {/* Input 4 */}
        <Animated.View style={styles.inputGroup}>
          <SkeletonBox width="25%" height={16} style={{ marginBottom: spacing.sm }} />
          <SkeletonBox width="100%" height={48} borderRadius={radius.md} />
        </Animated.View>

        {/* Images Section */}
        <Animated.View style={styles.inputGroup}>
          <SkeletonBox width="45%" height={16} style={{ marginBottom: spacing.sm }} />
          <Animated.View style={styles.imagesRow}>
            <SkeletonBox width={100} height={100} borderRadius={radius.md} />
            <SkeletonBox width={100} height={100} borderRadius={radius.md} style={{ marginLeft: spacing.md }} />
            <SkeletonBox width={100} height={100} borderRadius={radius.md} style={{ marginLeft: spacing.md }} />
          </Animated.View>
        </Animated.View>

        {/* Categories Section */}
        <Animated.View style={styles.inputGroup}>
          <SkeletonBox width="40%" height={16} style={{ marginBottom: spacing.sm }} />
          <Animated.View style={styles.tagsRow}>
            <SkeletonBox width={90} height={32} borderRadius={radius.pill} />
            <SkeletonBox width={110} height={32} borderRadius={radius.pill} style={{ marginLeft: spacing.sm }} />
            <SkeletonBox width={85} height={32} borderRadius={radius.pill} style={{ marginLeft: spacing.sm }} />
          </Animated.View>
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

/* ─── BarProfileSkeleton: skeleton para perfil de bar ─── */

export function BarProfileSkeleton() {
  return (
    <Animated.View style={styles.barProfileContainer}>
      {/* Header */}
      <Animated.View style={styles.barHeaderSkeleton}>
        <SkeletonBox width="60%" height={28} />
      </Animated.View>

      {/* Images */}
      <Animated.View style={styles.barImagesSection}>
        <SkeletonBox width="100%" height={200} borderRadius={radius.xl} />
      </Animated.View>

      {/* Info Section */}
      <Animated.View style={styles.barInfoSection}>
        <SkeletonBox width="50%" height={20} style={{ marginBottom: spacing.lg }} />
        <Animated.View style={styles.infoItemSkeleton}>
          <SkeletonBox width={20} height={20} borderRadius={radius.sm} />
          <Animated.View style={styles.infoItemContent}>
            <SkeletonBox width="30%" height={14} />
            <SkeletonBox width="80%" height={16} style={{ marginTop: spacing.xs }} />
          </Animated.View>
        </Animated.View>
        <Animated.View style={styles.infoItemSkeleton}>
          <SkeletonBox width={20} height={20} borderRadius={radius.sm} />
          <Animated.View style={styles.infoItemContent}>
            <SkeletonBox width="30%" height={14} />
            <SkeletonBox width="70%" height={16} style={{ marginTop: spacing.xs }} />
          </Animated.View>
        </Animated.View>
      </Animated.View>

      {/* Tags Section */}
      <Animated.View style={styles.barTagsSection}>
        <Animated.View style={styles.tagsRow}>
          <SkeletonBox width={100} height={32} borderRadius={radius.pill} />
          <SkeletonBox width={120} height={32} borderRadius={radius.pill} style={{ marginLeft: spacing.sm }} />
          <SkeletonBox width={90} height={32} borderRadius={radius.pill} style={{ marginLeft: spacing.sm }} />
        </Animated.View>
      </Animated.View>

      {/* Matches Section */}
      <Animated.View style={styles.barMatchesSection}>
        <SkeletonBox width="50%" height={20} style={{ marginBottom: spacing.lg }} />
        <Animated.View style={styles.matchCardSkeleton}>
          <Animated.View style={styles.matchTeams}>
            <SkeletonBox width={64} height={64} borderRadius={radius.md} />
            <SkeletonBox width={40} height={20} style={{ marginHorizontal: spacing.lg }} />
            <SkeletonBox width={64} height={64} borderRadius={radius.md} />
          </Animated.View>
          <SkeletonBox width="60%" height={16} style={{ marginTop: spacing.md, alignSelf: 'center' }} />
        </Animated.View>
      </Animated.View>

      {/* Posts Section */}
      <Animated.View style={styles.barPostsSection}>
        <SkeletonBox width="40%" height={20} style={{ marginBottom: spacing.lg }} />
        <SkeletonCard />
      </Animated.View>
    </Animated.View>
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
  // ProfileSkeleton styles
  profileContainer: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: spacing.xxxl,
    paddingHorizontal: spacing.lg,
  },
  sectionContainer: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xxxl,
  },
  barCardSkeleton: {
    backgroundColor: colors.bg.card,
    borderRadius: radius.md,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
  },
  barCardContent: {
    flex: 1,
    marginLeft: spacing.lg,
  },
  settingsSkeleton: {
    backgroundColor: colors.bg.card,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  // BarProfileSkeleton styles
  barProfileContainer: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  barHeaderSkeleton: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  barImagesSection: {
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.lg,
  },
  barInfoSection: {
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.lg,
  },
  infoItemSkeleton: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.lg,
  },
  infoItemContent: {
    flex: 1,
    marginLeft: spacing.md,
  },
  barTagsSection: {
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.lg,
  },
  tagsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  barMatchesSection: {
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.lg,
  },
  matchCardSkeleton: {
    backgroundColor: colors.bg.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
  },
  matchTeams: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  barPostsSection: {
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.lg,
  },
  // MapSkeleton styles
  mapSkeletonContainer: {
    flex: 1,
    backgroundColor: colors.bg.primary,
    position: 'relative',
  },
  mapTopControls: {
    position: 'absolute',
    top: 60, // Igual que Map.tsx: Platform.OS === 'ios' ? 60 : 40
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    zIndex: 10,
  },
  mapButton: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 5,
  },
  mapButtonFlex: {
    flex: 1,
  },
  mapButtonCircle: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  mapArea: {
    flex: 1,
    backgroundColor: '#1A252F', // Darker map-like background
    position: 'relative',
  },
  mapGridLine: {
    position: 'absolute',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  mapGridLineHorizontal: {
    width: '100%',
    height: 1,
  },
  mapGridLineVertical: {
    width: 1,
    height: '100%',
  },
  mapMarker: {
    position: 'absolute',
  },
  mapUserLocation: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -12,
    marginLeft: -12,
    zIndex: 5,
  },
  mapUserLocationRing: {
    position: 'absolute',
    top: -8,
    left: -8,
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'rgba(0, 122, 255, 0.3)',
    backgroundColor: 'transparent',
  },
  mapCenterButton: {
    position: 'absolute',
    bottom: 120, // Exactamente igual que Map.tsx
    right: 20,
    zIndex: 10,
  },
  // EditBarSkeleton styles
  editBarContainer: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  editBarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  editBarInfo: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.xl,
  },
  editBarForm: {
    paddingHorizontal: spacing.xl,
    gap: spacing.xl,
  },
  inputGroup: {
    marginBottom: spacing.lg,
  },
  imagesRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
