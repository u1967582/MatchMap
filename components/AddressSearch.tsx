import * as React from 'react';
import { useState, useCallback } from 'react';
import { View, TextInput, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import { AppText } from '~/components/ds';
import { Ionicons } from '@expo/vector-icons';

interface AddressSearchProps {
  onAddressSelect: (address: SearchResult) => void;
  placeholder?: string;
}

interface SearchResult {
  id: string;
  place_name: string;
  text: string;
  context?: Array<{ id: string; text: string }>;
  geometry?: {
    coordinates: [number, number];
  };
  door_number?: string;
}

const AddressSearch: React.FC<AddressSearchProps> = ({ 
  onAddressSelect, 
  placeholder = "Buscar dirección..." 
}) => {
  const [searchsetSearchText] = useState('');
  const [doorNumber, setDoorNumber] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<SearchResult | null>(null);
  const [preciseSearchLoading, setPreciseSearchLoading] = useState(false);

  const searchAddress = useCallback(async (query: string) => {
    if (!query.trim() || query.length < 3) {
      setResults([]);
      setShowResults(false);
      return;
    }

    setLoading(true);
    try {
      const token = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;
      if (!token) {
        console.warn('Mapbox token not configured');
        return;
      }

      const encodedQuery = encodeURIComponent(query);
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedQuery}.json?access_token=${token}&country=es&language=es&types=address,poi&limit=5`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.features) {
        setResults(data.features);
        setShowResults(true);
      }
    } catch (error) {
      console.error('Error searching address:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const searchPreciseAddress = useCallback(async (baseAddress: string, doorNumber: string) => {
    if (!selectedAddress || !doorNumber.trim()) {
      console.log('⚠️ No selected address or door number');
      const modifiedAddress: SearchResult = {
        ...selectedAddress!,
        place_name: baseAddress,
        door_number: doorNumber
      };
      onAddressSelect(modifiedAddress);
      return;
    }

    setPreciseSearchLoading(true);
    try {
      const token = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;
      if (!token) {
        console.warn('Mapbox token not configured');
        return;
      }

      // Extract address components separately
      const street = selectedAddress.text;
      const city = selectedAddress.context?.find((c: any) => c.id.startsWith('place'))?.text;
      const postal = selectedAddress.context?.find((c: any) => c.id.startsWith('postcode'))?.text;

      // Form structured query for precise search
      const preciseQuery = `${street} ${doorNumber}, ${postal ?? ''} ${city ?? ''}`.trim();
      const encodedQuery = encodeURIComponent(preciseQuery);
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedQuery}.json?access_token=${token}&country=es&language=es&types=address&limit=1`;

      console.log('🔍 Searching precise address with structured query:');
      console.log('📍 Street:', street);
      console.log('📍 City:', city);
      console.log('📍 Postal:', postal);
      console.log('📍 Door number:', doorNumber);
      console.log('📍 Structured query:', preciseQuery);
      console.log('🔗 URL:', url);

      const response = await fetch(url);
      const data = await response.json();

      console.log('📊 Mapbox response:', JSON.stringify(data, null, 2));

      if (data.features && data.features.length > 0) {
        const preciseFeature = data.features[0];
        console.log('📍 Precise address found:', preciseFeature);
        console.log('📍 Precise coordinates:', preciseFeature.geometry?.coordinates);

        const modifiedAddress: SearchResult = {
          ...preciseFeature,
          place_name: preciseFeature.place_name,
          door_number: doorNumber,
          // Use the precise coordinates
          geometry: preciseFeature.geometry
        };

        onAddressSelect(modifiedAddress);
      } else {
        // Try alternative search with different parameters
        console.log('⚠️ Precise search failed, trying alternative search...');
        
        // Try with different search parameters
        const alternativeUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedQuery}.json?access_token=${token}&country=es&language=es&limit=1`;
        
        const altResponse = await fetch(alternativeUrl);
        const altData = await altResponse.json();
        
        if (altData.features && altData.features.length > 0) {
          const altFeature = altData.features[0];
          console.log('📍 Alternative address found:', altFeature);
          
          const modifiedAddress: SearchResult = {
            ...altFeature,
            place_name: `${street} ${doorNumber}, ${city || ''}`,
            door_number: doorNumber,
            geometry: altFeature.geometry
          };
          
          onAddressSelect(modifiedAddress);
        } else {
          // Final fallback to base address
          console.log('⚠️ All precise searches failed, using base address');
          const modifiedAddress: SearchResult = {
            ...selectedAddress!,
            place_name: `${street} ${doorNumber}, ${city || ''}`,
            door_number: doorNumber
          };
          onAddressSelect(modifiedAddress);
        }
      }
    } catch (error) {
      console.error('Error searching precise address:', error);
      // Fallback to base address
      const modifiedAddress: SearchResult = {
        ...selectedAddress!,
        place_name: `${selectedAddress.text} ${doorNumber}, ${selectedAddress.context?.find((c: any) => c.id.startsWith('place'))?.text || ''}`,
        door_number: doorNumber
      };
      onAddressSelect(modifiedAddress);
    } finally {
      setPreciseSearchLoading(false);
    }
  }, [selectedAddress, onAddressSelect]);

  const handleTextChange = useCallback((text: string) => {
    setSearchText(text);
    searchAddress(text);
  }, [searchAddress]);

  const handleSelectAddress = useCallback((item: SearchResult) => {
    setSelectedAddress(item);
    setSearchText(item.place_name);
    setShowResults(false);
    setDoorNumber(''); // Reset door number when selecting new address
  }, []);

  const handleConfirmAddress = useCallback(() => {
    if (selectedAddress && doorNumber.trim()) {
      // Extract address components for precise search
      const street = selectedAddress.text;
      const city = selectedAddress.context?.find((c: any) => c.id.startsWith('place'))?.text;
      const postal = selectedAddress.context?.find((c: any) => c.id.startsWith('postcode'))?.text;
      
      console.log('📍 Confirming address with components:');
      console.log('📍 Street:', street);
      console.log('📍 City:', city);
      console.log('📍 Postal:', postal);
      console.log('📍 Door number:', doorNumber);
      
      searchPreciseAddress(street, doorNumber);
    }
  }, [selectedAddress, doorNumber, searchPreciseAddress]);

  const renderSearchResult = useCallback(({ item }: { item: SearchResult }) => (
    <TouchableOpacity
      style={styles.resultItem}
      onPress={() => handleSelectAddress(item)}
    >
      <Ionicons name="location" size={16} color="#007AFF" />
      <AppText style={styles.resultText} numberOfLines={2}>
        {item.place_name}
      </AppText>
    </TouchableOpacity>
  ), [handleSelectAddress]);

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#8E8E93" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          value={searchText}
          onChangeText={handleTextChange}
          placeholder={placeholder}
          placeholderTextColor="#8E8E93"
          autoCapitalize="none"
          autoCorrect={false}
        />
        {loading && (
          <Ionicons name="ellipsis-horizontal" size={20} color="#8E8E93" />
        )}
      </View>

      {showResults && results.length > 0 && (
        <View style={styles.resultsContainer}>
          <FlatList
            data={results}
            renderItem={renderSearchResult}
            keyExtractor={(item) => item.id}
            style={styles.resultsList}
            showsVerticalScrollIndicator={false}
          />
        </View>
      )}

      {selectedAddress && !showResults && (
        <View style={styles.doorNumberContainer}>
          <AppText style={styles.doorNumberLabel}>Número de puerta:</AppText>
          <View style={styles.doorNumberInputContainer}>
            <TextInput
              style={styles.doorNumberInput}
              value={doorNumber}
              onChangeText={setDoorNumber}
              placeholder="Ej: 19"
              placeholderTextColor="#8E8E93"
              keyboardType="numeric"
              maxLength={10}
            />
            <TouchableOpacity
              style={[styles.confirmButton, preciseSearchLoading && styles.confirmButtonDisabled]}
              onPress={handleConfirmAddress}
              disabled={preciseSearchLoading}
            >
              {preciseSearchLoading ? (
                <Ionicons name="ellipsis-horizontal" size={16} color="#FFFFFF" />
              ) : (
                <AppText style={styles.confirmButtonText}>Confirmar</AppText>
              )}
            </TouchableOpacity>
          </View>
          <AppText style={styles.addressPreview}>
            Dirección: {selectedAddress.place_name} {doorNumber}
          </AppText>
          {preciseSearchLoading && (
            <AppText style={styles.loadingText}>
              Buscando coordenadas precisas...
            </AppText>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    zIndex: 1000,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#374151',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
  },
  resultsContainer: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#2A3A4A',
    borderRadius: 8,
    marginTop: 4,
    maxHeight: 200,
    zIndex: 1001,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  resultsList: {
    maxHeight: 200,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
    gap: 12,
  },
  resultText: {
    color: '#FFFFFF',
    fontSize: 14,
    flex: 1,
  },
  doorNumberContainer: {
    backgroundColor: '#2A3A4A',
    borderRadius: 8,
    padding: 16,
    marginTop: 8,
  },
  doorNumberLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  doorNumberInputContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  doorNumberInput: {
    flex: 1,
    backgroundColor: '#374151',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#FFFFFF',
    fontSize: 16,
  },
  confirmButton: {
    backgroundColor: '#007AFF',
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 80,
  },
  confirmButtonDisabled: {
    backgroundColor: '#374151',
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  addressPreview: {
    color: '#8E8E93',
    fontSize: 12,
    fontStyle: 'italic',
  },
  loadingText: {
    color: '#007AFF',
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 4,
  },
});

export default AddressSearch; 