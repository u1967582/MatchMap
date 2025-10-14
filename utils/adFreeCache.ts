import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'mm_ad_free_v1';

export async function setAdFreeCache(value: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, value ? '1' : '0');
  } catch {}
}

export async function getAdFreeCache(): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(KEY);
    return v === '1';
  } catch {
    return false;
  }
}


