import { supabase } from './supabase';

export const ensureStorageBucket = async () => {
  try {
    // Check if bucket exists
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      console.error('Error listing buckets:', listError);
      return false;
    }

    const bucketExists = buckets?.some(bucket => bucket.name === 'bar-images');
    
    if (!bucketExists) {
      console.log('Creating bar-images bucket...');
      
      // Create bucket
      const { error: createError } = await supabase.storage.createBucket('bar-images', {
        public: true,
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
        fileSizeLimit: 5242880, // 5MB
      });

      if (createError) {
        console.error('Error creating bucket:', createError);
        return false;
      }

      console.log('✅ bar-images bucket created successfully');
    } else {
      console.log('✅ bar-images bucket already exists');
    }

    return true;
  } catch (error) {
    console.error('Error ensuring storage bucket:', error);
    return false;
  }
};

export const getImageUrl = (path: string) => {
  const { data } = supabase.storage.from('bar-images').getPublicUrl(path);
  return data.publicUrl;
};

export const deleteImage = async (path: string) => {
  try {
    const { error } = await supabase.storage.from('bar-images').remove([path]);
    
    if (error) {
      console.error('Error deleting image:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error deleting image:', error);
    return false;
  }
}; 