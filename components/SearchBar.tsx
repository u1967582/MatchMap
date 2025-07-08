// components/SearchBar.tsx
import { View, TextInput, StyleSheet, Platform } from 'react-native';
import { useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  editable?: boolean;
}

const SearchBar: React.FC<SearchBarProps> = ({ 
  value, 
  onChangeText, 
  placeholder = 'Buscar ubicación...', 
  editable = true 
}) => {
  
  const handleTextChange = useCallback((text: string) => {
    onChangeText(text);
  }, [onChangeText]);

  const handleClear = useCallback(() => {
    onChangeText('');
  }, [onChangeText]);

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
});

export default memo(SearchBar);
