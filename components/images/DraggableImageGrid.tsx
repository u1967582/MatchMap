import React, { useState } from 'react';
import { View, StyleSheet, LayoutChangeEvent } from 'react-native';
import Animated, {
  useAnimatedReaction,
  useSharedValue,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
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
  columns?: number;
  itemSize?: number;
  gap?: number;
}

const DraggableImageGrid: React.FC<DraggableImageGridProps> = ({
  images,
  onReorder,
  onDelete,
  columns = 4,
  itemSize = 80,
  gap = 8,
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
});

export default DraggableImageGrid;
