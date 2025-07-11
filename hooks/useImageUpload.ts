import { useState } from 'react';
import { Alert } from 'react-native';
import { supabase } from '~/utils/supabase';

interface UploadResult {
  success: boolean;
  url?: string;
  path?: string;
  error?: string;
}

export const useImageUpload = () => {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const uploadBarImage = async (
    uri: string, 
    barId: string, 
    imageType: 'bar' | 'menu',
    order: number
  ): Promise<UploadResult> => {
    try {
      setUploading(true);
      setUploadProgress(0);

      // Get file extension
      const fileExt = uri.split('.').pop()?.toLowerCase() || 'jpg';
      
      // Create organized path structure
      let fileName: string;
      let path: string;
      
      if (imageType === 'bar') {
        // For bar images: cover.jpg, interior1.jpg, interior2.jpg, etc.
        fileName = order === 1 ? 'cover.jpg' : `interior${order - 1}.jpg`;
        path = `${barId}/${fileName}`;
      } else {
        // For menu images: menus/0.jpg, menus/1.jpg, etc.
        fileName = `${order - 1}.jpg`;
        path = `${barId}/menus/${fileName}`;
      }

      // Fetch and convert image to blob
      const response = await fetch(uri);
      const blob = await response.blob();
      
      setUploadProgress(30);

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('bar-images')
        .upload(path, blob, {
          contentType: blob.type,
          upsert: true, // Allow overwriting existing files
        });

      if (error) {
        console.error('Error uploading image:', error);
        return {
          success: false,
          error: error.message
        };
      }

      setUploadProgress(80);

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('bar-images')
        .getPublicUrl(data.path);

      setUploadProgress(100);

      return {
        success: true,
        url: publicUrl,
        path: data.path
      };
    } catch (error) {
      console.error('Error uploading image:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido'
      };
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const uploadMultipleBarImages = async (
    images: Array<{ uri: string; order: number }>,
    barId: string,
    imageType: 'bar' | 'menu'
  ): Promise<Array<{ url: string; path: string; order: number }>> => {
    const uploadedImages: Array<{ url: string; path: string; order: number }> = [];
    
    for (const image of images) {
      const result = await uploadBarImage(image.uri, barId, imageType, image.order);
      
      if (result.success && result.url && result.path) {
        uploadedImages.push({
          url: result.url,
          path: result.path,
          order: image.order
        });
      } else {
        console.error(`Failed to upload image with order ${image.order}:`, result.error);
        Alert.alert(
          'Error de subida',
          `No se pudo subir la imagen ${image.order}. ${result.error || 'Error desconocido'}`
        );
      }
    }
    
    return uploadedImages;
  };

  // Helper function to get public URL for existing images
  const getBarImageUrl = (barId: string, imageType: 'bar' | 'menu', order: number): string => {
    let path: string;
    
    if (imageType === 'bar') {
      const fileName = order === 1 ? 'cover.jpg' : `interior${order - 1}.jpg`;
      path = `${barId}/${fileName}`;
    } else {
      path = `${barId}/menus/${order - 1}.jpg`;
    }
    
    const { data } = supabase.storage
      .from('bar-images')
      .getPublicUrl(path);
    
    return data.publicUrl;
  };

  return {
    uploading,
    uploadProgress,
    uploadBarImage,
    uploadMultipleBarImages,
    getBarImageUrl
  };
}; 