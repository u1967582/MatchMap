import React from 'react';
import { View, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { AppText } from '~/components/ds';
import { Ionicons } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  runOnJS,
  useAnimatedReaction,
  type SharedValue,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import type { DraggableImage } from './DraggableImageGrid';

interface DraggableImageItemProps {
  image: DraggableImage;
  positions: SharedValue<{ [key: string]: { x: number; y: number; order: number } }>;
  onReorder: (imageId: string, newOrder: number) => void;
  onDelete: (imageId: string) => void;
  itemSize: number;
  gap: number;
  columns: number;
  totalItems: number;
}

const DraggableImageItem: React.FC<DraggableImageItemProps> = ({
  image,
  positions,
  onReorder,
  onDelete,
  itemSize,
  gap,
  columns,
  totalItems,
}) => {
  const isActive = useSharedValue(false);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const zIndex = useSharedValue(0);

  const triggerHaptic = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  // Calculate which position this item should be at based on hover
  const getNewOrder = (x: number, y: number) => {
    'worklet';

    const position = positions.value[image.id];
    if (!position) return 0;

    const absoluteX = position.x + x;
    const absoluteY = position.y + y;

    const col = Math.round(absoluteX / (itemSize + gap));
    const row = Math.round(absoluteY / (itemSize + gap));

    const clampedCol = Math.max(0, Math.min(columns - 1, col));
    const clampedRow = Math.max(0, Math.min(Math.ceil(totalItems / columns) - 1, row));

    let newOrder = clampedRow * columns + clampedCol;
    newOrder = Math.max(0, Math.min(totalItems - 1, newOrder));

    return newOrder;
  };

  // Update other items' positions when dragging
  useAnimatedReaction(
    () => {
      if (!isActive.value) return -1;
      return getNewOrder(translateX.value, translateY.value);
    },
    (newOrder, previousOrder) => {
      if (newOrder === -1 || newOrder === previousOrder) return;

      const currentOrder = positions.value[image.id]?.order;
      if (currentOrder === undefined || newOrder === currentOrder) return;

      // Shift other items
      Object.keys(positions.value).forEach((id) => {
        if (id === image.id) return;

        const pos = positions.value[id];
        let targetOrder = pos.order;

        if (currentOrder < newOrder) {
          // Moving forward: shift items back
          if (pos.order > currentOrder && pos.order <= newOrder) {
            targetOrder = pos.order - 1;
          }
        } else {
          // Moving backward: shift items forward
          if (pos.order >= newOrder && pos.order < currentOrder) {
            targetOrder = pos.order + 1;
          }
        }

        const col = targetOrder % columns;
        const row = Math.floor(targetOrder / columns);

        positions.value = {
          ...positions.value,
          [id]: {
            ...positions.value[id],
            x: col * (itemSize + gap),
            y: row * (itemSize + gap),
            order: targetOrder,
          },
        };
      });

      // Update dragged item's order (but not position yet)
      positions.value = {
        ...positions.value,
        [image.id]: {
          ...positions.value[image.id],
          order: newOrder,
        },
      };
    }
  );

  const panGesture = Gesture.Pan()
    .onStart(() => {
      isActive.value = true;
      scale.value = withSpring(1.3, { damping: 15, stiffness: 200 });
      zIndex.value = 9999;
      runOnJS(triggerHaptic)();
    })
    .onUpdate((event) => {
      translateX.value = event.translationX;
      translateY.value = event.translationY;
    })
    .onEnd(() => {
      const newOrder = getNewOrder(translateX.value, translateY.value);

      // Snap back to new position
      translateX.value = withSpring(0, { damping: 20, stiffness: 300 });
      translateY.value = withSpring(0, { damping: 20, stiffness: 300 });
      scale.value = withSpring(1, { damping: 15, stiffness: 200 }, () => {
        // Reset zIndex after animation completes
        zIndex.value = 0;
      });

      isActive.value = false;

      runOnJS(onReorder)(image.id, newOrder);
      runOnJS(triggerHaptic)();
    });

  const longPressGesture = Gesture.LongPress()
    .minDuration(300)
    .onStart(() => {
      runOnJS(triggerHaptic)();
    });

  const composedGesture = Gesture.Simultaneous(longPressGesture, panGesture);

  const animatedStyle = useAnimatedStyle(() => {
    const position = positions.value[image.id];

    if (!position) {
      return {
        position: 'absolute',
        width: itemSize,
        height: itemSize,
      };
    }

    return {
      position: 'absolute',
      width: itemSize,
      height: itemSize,
      left: withSpring(position.x, { damping: 20, stiffness: 300 }),
      top: withSpring(position.y, { damping: 20, stiffness: 300 }),
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale.value },
      ],
      zIndex: zIndex.value,
    };
  });

  const shadowStyle = useAnimatedStyle(() => ({
    shadowColor: isActive.value ? '#007AFF' : '#000',
    shadowOffset: { width: 0, height: isActive.value ? 10 : 4 },
    shadowOpacity: withTiming(isActive.value ? 0.6 : 0.3, { duration: 200 }),
    shadowRadius: withTiming(isActive.value ? 15 : 8, { duration: 200 }),
    elevation: isActive.value ? 15 : 5,
  }));

  const handleStyle = useAnimatedStyle(() => ({
    backgroundColor: isActive.value
      ? 'rgba(0, 122, 255, 0.9)'
      : 'rgba(0, 0, 0, 0.8)',
    transform: [{ scale: withSpring(isActive.value ? 1.2 : 1) }],
  }));

  return (
    <GestureDetector gesture={composedGesture}>
      <Animated.View style={[styles.container, animatedStyle, shadowStyle]}>
        <Image source={{ uri: image.image_url }} style={styles.image} />

        {/* Delete button */}
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => onDelete(image.id)}
        >
          <Ionicons name="trash-outline" size={16} color="#FF6B6B" />
        </TouchableOpacity>

        {/* Order badge */}
        <View style={styles.orderBadge}>
          <AppText maxScale={1.0} style={styles.orderText}>{image.image_order}</AppText>
        </View>

        {/* Drag handle */}
        <Animated.View style={[styles.dragHandle, handleStyle]}>
          <Ionicons name="reorder-three" size={24} color="#FFFFFF" />
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#2A3A4A',
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  deleteButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  orderBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: '#007AFF',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    paddingHorizontal: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  orderText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  dragHandle: {
    position: 'absolute',
    bottom: 4,
    left: '50%',
    marginLeft: -16,
    borderRadius: 8,
    width: 32,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
});

export default DraggableImageItem;
