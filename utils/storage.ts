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

// Helper functions for the new organized structure
export const getBarImageUrl = (barId: string, order: number) => {
  const fileName = order === 1 ? 'cover.jpg' : `interior${order - 1}.jpg`;
  const path = `${barId}/${fileName}`;
  return getImageUrl(path);
};

export const getMenuImageUrl = (barId: string, order: number) => {
  const path = `${barId}/menus/${order - 1}.jpg`;
  return getImageUrl(path);
};

export const deleteBarImages = async (barId: string) => {
  try {
    // List all files for this bar
    const { data: files, error: listError } = await supabase.storage
      .from('bar-images')
      .list(barId, { limit: 100 });

    if (listError) {
      console.error('Error listing bar images:', listError);
      return false;
    }

    if (files && files.length > 0) {
      // Delete all files
      const filePaths = files.map(file => `${barId}/${file.name}`);
      const { error: deleteError } = await supabase.storage
        .from('bar-images')
        .remove(filePaths);

      if (deleteError) {
        console.error('Error deleting bar images:', deleteError);
        return false;
      }
    }

    // Also delete menu images
    const { data: menuFiles, error: menuListError } = await supabase.storage
      .from('bar-images')
      .list(`${barId}/menus`, { limit: 100 });

    if (!menuListError && menuFiles && menuFiles.length > 0) {
      const menuPaths = menuFiles.map(file => `${barId}/menus/${file.name}`);
      await supabase.storage.from('bar-images').remove(menuPaths);
    }

    return true;
  } catch (error) {
    console.error('Error deleting bar images:', error);
    return false;
  }
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