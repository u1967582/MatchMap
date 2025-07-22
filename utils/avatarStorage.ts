import { supabase } from './supabase';

export const ensureAvatarsBucket = async () => {
  try {
    // Check if bucket exists
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      console.error('Error listing buckets:', listError);
      return false;
    }

    const bucketExists = buckets?.some(bucket => bucket.name === 'avatars');
    
    if (!bucketExists) {
      console.log('Creating avatars bucket...');
      
      // Create bucket
      const { error: createError } = await supabase.storage.createBucket('avatars', {
        public: true,
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
        fileSizeLimit: 2097152, // 2MB
      });

      if (createError) {
        console.error('Error creating bucket:', createError);
        return false;
      }

      console.log('✅ avatars bucket created successfully');
    } else {
      console.log('✅ avatars bucket already exists');
    }

    return true;
  } catch (error) {
    console.error('Error ensuring avatars bucket:', error);
    return false;
  }
};

export const getAvatarUrl = (path: string) => {
  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  return data.publicUrl;
};

export const deleteAvatar = async (path: string) => {
  try {
    const { error } = await supabase.storage.from('avatars').remove([path]);
    
    if (error) {
      console.error('Error deleting avatar:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error deleting avatar:', error);
    return false;
  }
}; 