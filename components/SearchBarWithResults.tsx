// components/SearchBarWithResults.tsx
import { View, TextInput, StyleSheet, Platform, FlatList, TouchableOpacity, Text, Animated } from 'react-native';
import { useCallback, useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
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

export interface SearchBarRef {
  expand: () => void;
  collapse: () => void;
}

interface SearchBarWithResultsProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  editable?: boolean;
  searchResults: SearchResult[];
  isSearching: boolean;
  onLocationSelect: (location: SearchResult) => void;
  onExpandChange?: (isExpanded: boolean) => void;
}

const SearchBarWithResults = forwardRef<SearchBarRef, SearchBarWithResultsProps>(({ 
  value, 
  onChangeText, 
  placeholder = 'Buscar ciudad, lugar...', 
  editable = true,
  searchResults,
  isSearching,
  onLocationSelect,
  onExpandChange
}, ref) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const widthAnim = useRef(new Animated.Value(0)).current;
  
  const handleCollapse = useCallback(() => {
    setIsExpanded(false);
    onExpandChange?.(false);
    onChangeText('');
    inputRef.current?.blur();
    Animated.spring(widthAnim, {
      toValue: 0,
      useNativeDriver: false,
      tension: 50,
      friction: 7,
    }).start();
  }, [onChangeText, widthAnim, onExpandChange]);
  
  // Auto-colapsar desactivado - se controla manualmente desde el componente padre
  // useEffect(() => {
  //   if (value.length === 0 && isExpanded && searchResults.length === 0) {
  //     const timer = setTimeout(() => {
  //       handleCollapse();
  //     }, 200);
  //     return () => clearTimeout(timer);
  //   }
  // }, [value, searchResults.length, isExpanded, handleCollapse]);
  
  const handleExpand = useCallback(() => {
    setIsExpanded(true);
    onExpandChange?.(true);
    Animated.spring(widthAnim, {
      toValue: 1,
      useNativeDriver: false,
      tension: 50,
      friction: 7,
    }).start(() => {
      inputRef.current?.focus();
    });
  }, [widthAnim, onExpandChange]);

  // Expose expand/collapse methods to parent
  useImperativeHandle(ref, () => ({
    expand: handleExpand,
    collapse: handleCollapse
  }), [handleExpand, handleCollapse]);
  
  const handleTextChange = useCallback((text: string) => {
    onChangeText(text);
  }, [onChangeText]);

  const handleClear = useCallback(() => {
    onChangeText('');
    inputRef.current?.focus();
  }, [onChangeText]);

  const handleLocationSelect = useCallback((location: SearchResult) => {
    onLocationSelect(location);
    handleCollapse();
  }, [onLocationSelect, handleCollapse]);

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
        onPress={() => handleLocationSelect(item)}
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
  }, [handleLocationSelect]);

  // Interpolación de ancho
  const animatedWidth = widthAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 350], // De 0px (oculto) a 350px (barra completa)
  });

  const animatedOpacity = widthAnim.interpolate({
    inputRange: [0, 0.1, 1],
    outputRange: [0, 1, 1], // Fade in rápido
  });

  // No mostrar nada si está colapsado
  if (!isExpanded) {
    return null;
  }

  return (
    <View style={styles.searchContainer}>
      <Animated.View style={[styles.inputContainer, { width: animatedWidth, opacity: animatedOpacity }]}>
        <Ionicons 
          name="search" 
          size={20} 
          color="#8E8E93" 
          style={styles.searchIcon} 
        />
        <TextInput
          ref={inputRef}
          style={styles.searchInput}
          placeholder={placeholder}
          placeholderTextColor="#B8C5D6"
          value={value}
          onChangeText={handleTextChange}
          autoCapitalize="none"
          autoCorrect={false}
          editable={editable}
          returnKeyType="search"
          clearButtonMode="never"
        />
        {value.length > 0 ? (
          <TouchableOpacity onPress={handleClear} style={styles.iconButton}>
          <Ionicons 
            name="close-circle" 
            size={20} 
            color="#8E8E93" 
            />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={handleCollapse} style={styles.iconButton}>
            <Ionicons 
              name="close" 
              size={20} 
              color="#8E8E93" 
            />
          </TouchableOpacity>
        )}
      </Animated.View>

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
});

SearchBarWithResults.displayName = 'SearchBarWithResults';

export default memo(SearchBarWithResults);

const styles = StyleSheet.create({
  searchContainer: {
    width: '100%',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3A4F68',
    borderRadius: 25,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 50,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 12,
  },
  collapsedButton: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
    paddingVertical: 0,
  },
  iconButton: {
    marginLeft: 8,
    padding: 4,
  },
  resultsContainer: {
    backgroundColor: '#3A4F68',
    borderRadius: 12,
    marginTop: 8,
    maxHeight: 300,
    width: 350, // Match the expanded search bar width
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 12,
  },
  resultsList: {
    maxHeight: 250,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  resultIcon: {
    marginRight: 12,
  },
  resultTextContainer: {
    flex: 1,
  },
  resultTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  resultSubtitle: {
    fontSize: 13,
    color: '#E8EEF5',
    fontWeight: '500',
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