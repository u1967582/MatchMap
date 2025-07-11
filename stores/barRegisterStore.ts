import { create } from 'zustand';

export interface BarCategory {
  id: string;
  name: string;
  description?: string;
}

interface BarRegisterState {
  // Step 1: General Info
  name: string;
  description: string;
  phone: string;
  website: string;
  categoryId: string | null;
  
  // Step 2: Extra Info
  languageIds: string[];
  foodTypeIds: string[];
  featureIds: string[];
  
  // Step 3: Location
  address: string;
  city: string;
  postalCode: string;
  latitude: number;
  longitude: number;
  
  // Step 4: Photos
  barPhotos: string[];
  menuPhotos: string[];
  
  // Categories data
  categories: BarCategory[];
  
  // Actions
  setField: (key: keyof BarRegisterState, value: any) => void;
  setCategories: (categories: BarCategory[]) => void;
  resetForm: () => void;
  getFormData: () => Omit<BarRegisterState, 'setField' | 'setCategories' | 'resetForm' | 'getFormData' | 'categories'>;
}

const initialState = {
  name: '',
  description: '',
  phone: '',
  website: '',
  categoryId: null,
  languageIds: [],
  foodTypeIds: [],
  featureIds: [],
  address: '',
  city: '',
  postalCode: '',
  latitude: 0,
  longitude: 0,
  barPhotos: [],
  menuPhotos: [],
  categories: [],
};

export const useBarRegisterStore = create<BarRegisterState>((set, get) => ({
  ...initialState,
  
  setField: (key: keyof BarRegisterState, value: any) => set((state: BarRegisterState) => ({ ...state, [key]: value })),
  
  setCategories: (categories: BarCategory[]) => set({ categories }),
  
  resetForm: () => set(initialState),
  
  getFormData: () => {
    const state = get();
    const { setField, setCategories, resetForm, getFormData, categories, ...formData } = state;
    return formData;
  },
})); 