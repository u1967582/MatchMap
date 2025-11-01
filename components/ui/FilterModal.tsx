import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Dimensions,
  ActivityIndicator,
  GestureResponderEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import SelectableChip from './SelectableChip';

interface FilterItem {
  id: number;
  name: string;
  emoji: string;
}

interface FilterModalProps {
  visible: boolean;
  onClose: () => void;
  barCategories: FilterItem[];
  foodTypes: FilterItem[];
  barFeatures: FilterItem[];
  languages: FilterItem[];
  selectedBarCategories: number[];
  selectedFoodTypes: number[];
  selectedFeatures: number[];
  selectedLanguages: number[];
  onBarCategoriesChange: (categories: number[]) => void;
  onFoodTypesChange: (foodTypes: number[]) => void;
  onFeaturesChange: (features: number[]) => void;
  onLanguagesChange: (languages: number[]) => void;
  loading?: boolean;
  onApplyFilters?: () => void;
}

const { height } = Dimensions.get('window');

export default function FilterModal({
  visible,
  onClose,
  barCategories,
  foodTypes,
  barFeatures,
  languages,
  selectedBarCategories,
  selectedFoodTypes,
  selectedFeatures,
  selectedLanguages,
  onBarCategoriesChange,
  onFoodTypesChange,
  onFeaturesChange,
  onLanguagesChange,
  onApplyFilters,
  loading = false,
}: FilterModalProps) {
  console.log('🔍 FilterModal - Props received:', {
    visible,
    barCategoriesLength: barCategories?.length || 0,
    foodTypesLength: foodTypes?.length || 0,
    barFeaturesLength: barFeatures?.length || 0,
    languagesLength: languages?.length || 0,
    loading
  });

  const toggleCategory = (categoryId: number) => {
    const newCategories = selectedBarCategories.includes(categoryId)
      ? selectedBarCategories.filter(id => id !== categoryId)
      : [...selectedBarCategories, categoryId];
    onBarCategoriesChange(newCategories);
  };

  const toggleFoodType = (foodTypeId: number) => {
    const newFoodTypes = selectedFoodTypes.includes(foodTypeId)
      ? selectedFoodTypes.filter(id => id !== foodTypeId)
      : [...selectedFoodTypes, foodTypeId];
    onFoodTypesChange(newFoodTypes);
  };

  const toggleFeature = (featureId: number) => {
    const newFeatures = selectedFeatures.includes(featureId)
      ? selectedFeatures.filter(id => id !== featureId)
      : [...selectedFeatures, featureId];
    onFeaturesChange(newFeatures);
  };

  const toggleLanguage = (languageId: number) => {
    const newLanguages = selectedLanguages.includes(languageId)
      ? selectedLanguages.filter(id => id !== languageId)
      : [...selectedLanguages, languageId];
    onLanguagesChange(newLanguages);
  };

  const clearAllFilters = () => {
    onBarCategoriesChange([]);
    onFoodTypesChange([]);
    onFeaturesChange([]);
    onLanguagesChange([]);
  };

  const getActiveFiltersCount = () => {
    return selectedBarCategories.length + selectedFoodTypes.length + 
           selectedFeatures.length + selectedLanguages.length;
  };

  console.log('🔍 FilterModal - About to render, visible:', visible);

  const renderSection = (
    title: string,
    items: FilterItem[],
    selectedItems: number[],
    onToggle: (id: number) => void
  ) => {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{title}</Text>
  
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#1976D2" />
            <Text style={styles.loadingText}>Cargando opciones...</Text>
          </View>
        ) : items && items.length > 0 ? (
          <View style={styles.chipsWrapContainer}>
            {items.map((item, index) => (
              <SelectableChip
                key={item.id}
                icon={item.emoji}
                label={item.name}
                selected={selectedItems.includes(item.id)}
                onPress={() => onToggle(item.id)}
              />
            ))}
          </View>
        ) : (
          <Text style={styles.emptyText}>No hay opciones disponibles</Text>
        )}
      </View>
    );
  };
  
  

  function handleApplyFilters(event: GestureResponderEvent): void {
    console.log('✅ Aplicando filtros...');
  if (onApplyFilters) {
    onApplyFilters(); // Llama al callback externo si existe
  }
  onClose(); // Cierra el modal
  }

  return (
      <Modal
    visible={visible}
    animationType="slide"
    transparent={true}
    onRequestClose={onClose}
  >
    <View style={styles.overlay}>
      <View style={styles.modalContainer}>
        {/* Close button */}
        <TouchableOpacity 
          style={styles.closeButton}
          onPress={onClose}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close" size={20} color="rgba(163, 179, 204, 0.6)" />
        </TouchableOpacity>

        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>🎯 Filtros disponibles</Text>

          {renderSection('Tipo de bar', barCategories, selectedBarCategories, toggleCategory)}
          {renderSection('Tipo de comida', foodTypes, selectedFoodTypes, toggleFoodType)}
          {renderSection('Características', barFeatures, selectedFeatures, toggleFeature)}
          {renderSection('Idiomas', languages, selectedLanguages, toggleLanguage)}
        </ScrollView>

        {/* Botón fijo al fondo */}
        <TouchableOpacity style={styles.applyButton} onPress={handleApplyFilters}>
          <Text style={styles.applyButtonText}>Aplicar filtros ({getActiveFiltersCount()})</Text>
        </TouchableOpacity>
      </View>
    </View>
  </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#1C2A3A',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: height * 0.9,
    width: '100%',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
    backgroundColor: 'rgba(42, 58, 74, 0.3)', // Más transparente
    borderRadius: 20,
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2A3A4A',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  clearButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#374151',
  },
  clearButtonText: {
    color: '#A3B3CC',
    fontSize: 14,
    fontWeight: '500',
  },
  closeButton: {
    marginTop: 24,
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#1976D2',
    borderRadius: 20,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    backgroundColor: '#1A2A3A',
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  sectionHeaderLeft: {
    flex: 1,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  sectionSubtitle: {
    color: '#A3B3CC',
    fontSize: 12,
    fontWeight: '400',
  },
  sectionHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    backgroundColor: '#1976D2',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  chipsContainer: {
    maxHeight: 200,
    backgroundColor: '#1A2A3A',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3A4A5A',
    padding: 12,
  },
  debugChipCount: {
    color: '#FFFFFF',
    fontSize: 12,
    marginBottom: 8,
    width: '100%',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
  },
  loadingText: {
    color: '#A3B3CC',
    fontSize: 14,
    marginTop: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
  },
  emptyText: {
    color: '#A3B3CC',
    fontSize: 14,
    fontStyle: 'italic',
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#2A3A4A',
  },
  applyButton: {
    backgroundColor: '#1976D2',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  applyButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  chipsScrollContent: {
    flexDirection: 'row',
    paddingRight: 12,
    paddingVertical: 4,
    flexWrap: 'wrap',
    gap: 8,
  },
  modalBackground: {
    flex: 1,
    backgroundColor: 'rgba(14,27,44,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  closeText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  chipsWrapContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  scrollContainer: {
    paddingBottom: 20,
    paddingTop: 10,
  },
  
});