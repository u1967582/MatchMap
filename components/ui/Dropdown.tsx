import { useState, useRef } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Modal,
  FlatList,
  Dimensions,
} from 'react-native';
import { AppText } from '~/components/ds';
import { Ionicons } from '@expo/vector-icons';

interface DropdownOption {
  id: string;
  label: string;
  value: string;
}

interface DropdownProps {
  label: string;
  options: DropdownOption[];
  selectedValue: string;
  onSelect: (value: string) => void;
  placeholder?: string;
}

const { width } = Dimensions.get('window');

export default function Dropdown({
  label,
  options,
  selectedValue,
  onSelect,
  placeholder = 'Seleccionar',
}: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ x: 0, y: 0, width: 0 });
  const buttonRef = useRef<any>(null);

  const selectedOption = options.find(option => option.value === selectedValue);
  const displayText = String(selectedOption?.label || placeholder);

  const handlePress = () => {
    if (buttonRef.current) {
      buttonRef.current.measureInWindow((x: number, y: number, width: number, height: number) => {
        setDropdownPosition({ x, y: y + height, width });
        setIsOpen(true);
      });
    }
  };

  const handleSelect = (value: string) => {
    onSelect(value);
    setIsOpen(false);
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  // Safety check for options
  if (!Array.isArray(options) || options.length === 0) {
    return null;
  }

  return (
    <>
      <AppText style={{ position: 'absolute', left: -1000, width: 1, height: 1, opacity: 0 }}>{String(label)}</AppText>
      <TouchableOpacity
        ref={buttonRef}
        style={styles.dropdownButton}
        onPress={handlePress}
        activeOpacity={0.7}
      >
        <AppText style={styles.dropdownButtonText}>
          {String(displayText)}
        </AppText>
        <Ionicons
          name={isOpen ? "chevron-up" : "chevron-down"}
          size={12}
          color="#A3B3CC"
        />
      </TouchableOpacity>

      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={handleClose}
      >
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={handleClose}
        >
          <View
            style={[
              styles.dropdownMenu,
              {
                left: dropdownPosition.x,
                top: dropdownPosition.y,
                width: Math.max(dropdownPosition.width, 150),
              }
            ]}
          >
            <FlatList
              data={options}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => {
                // Safety check for item structure
                if (!item || typeof item.label !== 'string') {
                  return null;
                }
                return (
                <TouchableOpacity
                  style={[
                    styles.dropdownItem,
                    selectedValue === item.value && styles.dropdownItemActive
                  ]}
                  onPress={() => handleSelect(item.value)}
                >
                  <AppText style={[
                    styles.dropdownItemText,
                    selectedValue === item.value && styles.dropdownItemTextActive
                  ]}>
                    {String(item.label)}
                  </AppText>
                  {selectedValue === item.value && (
                    <Ionicons name="checkmark" size={16} color="#1976D2" />
                  )}
                </TouchableOpacity>
                );
              }}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#243243',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    marginRight: 12,
    gap: 6,
    minWidth: 100,
    minHeight: 44, // Match the filter button height
    justifyContent: 'center', // Center content
  },
  dropdownButtonActive: {
    backgroundColor: '#1976D2',
  },
  dropdownButtonText: {
    color: '#A3B3CC',
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  dropdownButtonTextActive: {
    color: '#FFFFFF',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  dropdownMenu: {
    position: 'absolute',
    backgroundColor: '#1A2332',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2A3A4A',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    maxHeight: 200,
    zIndex: 1000,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2A3A4A',
  },
  dropdownItemActive: {
    backgroundColor: '#2A3A4A',
  },
  dropdownItemText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  dropdownItemTextActive: {
    color: '#1976D2',
    fontWeight: '600',
  },
}); 