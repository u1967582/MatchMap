// components/SearchBarWithResults.tsx
import { View, TextInput, StyleSheet, Platform, FlatList, TouchableOpacity, Text } from 'react-native';
import { useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';

interface SearchResult {
  id: string;
  place_name: string;
  center: [number, number];
  text: string;
  place_type?: string[];
  context?: Array<{
    id: string;
    text: string;
  }>;
  properties?: {
    address?: string;
    city?: string;
  };
}

interface SearchBarWithResultsProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  editable?: boolean;
  searchResults: SearchResult[];
  isSearching: boolean;
  onLocationSelect: (location: SearchResult) => void;
}

const SearchBarWithResults: React.FC<SearchBarWithResultsProps> = ({ 
  value, 
  onChangeText, 
  placeholder = 'Buscar ciudad, lugar...', 
  editable = true,
  searchResults,
  isSearching,
  onLocationSelect
}) => {
  
  const handleTextChange = useCallback((text: string) => {
    onChangeText(text);
  }, [onChangeText]);

  const handleClear = useCallback(() => {
    onChangeText('');
  }, [onChangeText]);

  const renderSearchResult = useCallback(({ item }: { item: SearchResult }) => {
    // Determinar el icono según el tipo de lugar
    let iconName = 'location-outline';
    if (item.place_type?.includes('place')) {
      iconName = 'business-outline'; // Para ciudades, regiones
    } else if (item.place_type?.includes('poi')) {
      iconName = 'star-outline'; // Para puntos de interés
    } else if (item.place_type?.includes('address')) {
      iconName = 'home-outline'; // Para direcciones
    }

    // Obtener el contexto (ciudad, región, país)
    const context = item.context || [];
    const country = context.find((c: any) => c.id.includes('country'))?.text;
    const region = context.find((c: any) => c.id.includes('region'))?.text;
    const city = context.find((c: any) => c.id.includes('place'))?.text;

    // Crear subtítulo más informativo
    let subtitle = '';
    if (city && city !== item.text) {
      subtitle = `${city}`;
      if (region && region !== city) subtitle += `, ${region}`;
      if (country) subtitle += `, ${country}`;
    } else if (region && region !== item.text) {
      subtitle = `${region}`;
      if (country) subtitle += `, ${country}`;
    } else if (country && country !== item.text) {
      subtitle = country;
    }

    // Si no hay contexto específico, usar el place_name completo
    if (!subtitle) {
      subtitle = item.place_name.replace(item.text + ', ', '');
    }

    return (
      <TouchableOpacity
        style={styles.resultItem}
        onPress={() => onLocationSelect(item)}
      >
        <Ionicons name={iconName as any} size={16} color="#A3B3CC" style={styles.resultIcon} />
        <View style={styles.resultTextContainer}>
          <Text style={styles.resultTitle} numberOfLines={1}>
            {item.text}
          </Text>
          <Text style={styles.resultSubtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }, [onLocationSelect]);

  return (
    <View style={styles.searchContainer}>
      <View style={styles.inputContainer}>
        <Ionicons 
          name="search" 
          size={20} 
          color="#8E8E93" 
          style={styles.searchIcon} 
        />
        <TextInput
          style={styles.searchInput}
          placeholder={placeholder}
          placeholderTextColor="#8E8E93"
          value={value}
          onChangeText={handleTextChange}
          autoCapitalize="none"
          autoCorrect={false}
          editable={editable}
          returnKeyType="search"
          clearButtonMode="never"
        />
        {value.length > 0 && (
          <Ionicons 
            name="close-circle" 
            size={20} 
            color="#8E8E93" 
            style={styles.clearIcon}
            onPress={handleClear}
          />
        )}
      </View>

      {/* Search Results */}
      {(searchResults.length > 0 || isSearching) && value.length > 0 && (
        <View style={styles.resultsContainer}>
          {isSearching ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Buscando...</Text>
            </View>
          ) : (
            <FlatList
              data={searchResults}
              renderItem={renderSearchResult}
              keyExtractor={(item) => item.id}
              style={styles.resultsList}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            />
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  searchContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    left: 20,
    right: 20,
    zIndex: 1000,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3A4A5C',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    minHeight: 50,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#FFFFFF',
    paddingVertical: 0,
  },
  clearIcon: {
    marginLeft: 8,
    padding: 4,
  },
  resultsContainer: {
    backgroundColor: '#3A4A5C',
    borderRadius: 12,
    marginTop: 8,
    maxHeight: 300,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  resultsList: {
    maxHeight: 250,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2A3A4A',
  },
  resultIcon: {
    marginRight: 12,
  },
  resultTextContainer: {
    flex: 1,
  },
  resultTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  resultSubtitle: {
    fontSize: 12,
    color: '#A3B3CC',
  },
  loadingContainer: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  loadingText: {
    color: '#A3B3CC',
    fontSize: 14,
  },
});

export default memo(SearchBarWithResults); 