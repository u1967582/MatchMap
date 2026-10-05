import React, { useState } from 'react';
import { View, StyleSheet, LayoutChangeEvent, TouchableOpacity, Image } from 'react-native';
import Animated, {
  useAnimatedReaction,
  useSharedValue,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import DraggableImageItem from './DraggableImageItem';

export interface DraggableImage {
  id: string;
  image_url: string;
  image_order: number;
}

interface DraggableImageGridProps {
  images: DraggableImage[];
  onReorder: (reorderedImages: DraggableImage[]) => void;
  onDelete: (imageId: string) => void;
  /** Toque corto sobre una imagen (fuera de modo selección) — para abrir un visor en grande. */
  onImagePress?: (imageId: string) => void;
  columns?: number;
  itemSize?: number;
  gap?: number;
  isSelectMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (imageId: string) => void;
}

const DraggableImageGrid: React.FC<DraggableImageGridProps> = ({
  images,
  onReorder,
  onDelete,
  onImagePress,
  columns = 4,
  itemSize = 80,
  gap = 8,
  isSelectMode = false,
  selectedIds,
  onToggleSelect,
}) => {
  const [containerWidth, setContainerWidth] = useState(0);
  const positions = useSharedValue<{ [key: string]: { x: number; y: number; order: number } }>({});

  // Calculate grid positions
  React.useEffect(() => {
    const newPositions: { [key: string]: { x: number; y: number; order: number } } = {};

    images.forEach((image, index) => {
      const col = index % columns;
      const row = Math.floor(index / columns);

      newPositions[image.id] = {
        x: col * (itemSize + gap),
        y: row * (itemSize + gap),
        order: index,
      };
    });

    positions.value = newPositions;
  }, [images, columns, itemSize, gap]);

  const handleReorder = (draggedId: string, newOrder: number) => {
    try {
      const reorderedImages = [...images];
      const draggedIndex = images.findIndex(img => img.id === draggedId);

      // Validate draggedIndex
      if (draggedIndex === -1) {
        console.error('❌ Image not found:', draggedId);
        return;
      }

      // Validate newOrder
      if (newOrder < 0 || newOrder >= images.length) {
        console.error('❌ Invalid newOrder:', newOrder);
        return;
      }

      const draggedImage = reorderedImages[draggedIndex];

      if (!draggedImage) {
        console.error('❌ draggedImage is undefined');
        return;
      }

      // Remove from old position
      reorderedImages.splice(draggedIndex, 1);

      // Insert at new position
      reorderedImages.splice(newOrder, 0, draggedImage);

      // Update image_order
      const finalImages = reorderedImages.map((img, index) => ({
        ...img,
        image_order: index + 1,
      }));

      onReorder(finalImages);
    } catch (error) {
      console.error('❌ Error in handleReorder:', error);
    }
  };

  const onLayout = (event: LayoutChangeEvent) => {
    setContainerWidth(event.nativeEvent.layout.width);
  };

  const rows = Math.ceil(images.length / columns);
  const containerHeight = rows * (itemSize + gap) - gap;

  if (isSelectMode) {
    return (
      <View style={[styles.container, { height: containerHeight }]}>
        {images.map((image, index) => {
          const col = index % columns;
          const row = Math.floor(index / columns);
          const selected = selectedIds?.has(image.id) ?? false;
          return (
            <TouchableOpacity
              key={image.id}
              activeOpacity={0.8}
              style={[
                styles.selectItem,
                {
                  left: col * (itemSize + gap),
                  top: row * (itemSize + gap),
                  width: itemSize,
                  height: itemSize,
                },
              ]}
              onPress={() => onToggleSelect?.(image.id)}
            >
              <Image source={{ uri: image.image_url }} style={styles.selectImage} resizeMode="cover" />
              {selected && (
                <View style={styles.selectOverlay}>
                  <Ionicons name="checkmark-circle" size={28} color="#FFFFFF" />
                </View>
              )}
              {!selected && <View style={styles.selectUnchecked} />}
            </TouchableOpacity>
          );
        })}
      </View>
    );
  }

  return (
    <GestureHandlerRootView>
      <View style={[styles.container, { height: containerHeight }]} onLayout={onLayout}>
        {images.map((image, index) => (
          <DraggableImageItem
            key={image.id}
            image={image}
            positions={positions}
            onReorder={handleReorder}
            onDelete={onDelete}
            onPress={onImagePress}
            itemSize={itemSize}
            gap={gap}
            columns={columns}
            totalItems={images.length}
          />
        ))}
      </View>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    width: '100%',
  },
  selectItem: {
    position: 'absolute',
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#2A3A4A',
  },
  selectImage: {
    width: '100%',
    height: '100%',
  },
  selectOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 122, 255, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectUnchecked: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.8)',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
});

export default DraggableImageGrid;
