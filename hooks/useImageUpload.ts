import { useState } from 'react';
import { Alert } from 'react-native';
import { supabase } from '~/utils/supabase';
import { ensureStorageBucket } from '~/utils/storage';

interface UploadResult {
  success: boolean;
  url?: string;
  error?: string;
}

export const useImageUpload = () => {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const uploadImage = async (uri: string, path: string): Promise<UploadResult> => {
    try {
      setUploading(true);
      setUploadProgress(0);

      // Ensure bucket exists
      const bucketReady = await ensureStorageBucket();
      if (!bucketReady) {
        return {
          success: false,
          error: 'No se pudo preparar el almacenamiento de imágenes'
        };
      }

      const response = await fetch(uri);
      const blob = await response.blob();
      
      const arrayBuffer = await new Response(blob).arrayBuffer();
      
      setUploadProgress(50);

      const { data, error } = await supabase.storage
        .from('bar-images')
        .upload(path, arrayBuffer, {
          contentType: 'image/jpeg',
          upsert: false
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
        url: publicUrl
      };
    } catch (error) {
      console.error('Error uploading image:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const uploadMultipleImages = async (uris: string[], basePath: string): Promise<string[]> => {
    const uploadedUrls: string[] = [];
    
    for (let i = 0; i < uris.length; i++) {
      const timestamp = Date.now();
      const photoPath = `${basePath}/${timestamp}_${i}.jpg`;
      
      const result = await uploadImage(uris[i], photoPath);
      
      if (result.success && result.url) {
        uploadedUrls.push(result.url);
      } else {
        console.error(`Failed to upload image ${i}:`, result.error);
        Alert.alert(
          'Error de subida',
          `No se pudo subir la imagen ${i + 1}. ${result.error || 'Error desconocido'}`
        );
      }
    }
    
    return uploadedUrls;
  };

  return {
    uploading,
    uploadProgress,
    uploadImage,
    uploadMultipleImages
  };
}; 