import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { AppText } from '~/components/ds';
import { Ionicons } from '@expo/vector-icons';

interface CheckboxOption {
  id: string;
  label: string;
}

interface CheckboxGroupProps {
  label: string;
  options: CheckboxOption[];
  selectedIds: string[];
  onSelectionChange: (selectedIds: string[]) => void;
  required?: boolean;
  error?: string;
}

const CheckboxGroup: React.FC<CheckboxGroupProps> = ({
  label,
  options,
  selectedIds,
  onSelectionChange,
  required = false,
  error,
}) => {
  const handleToggle = (id: string) => {
    const newSelection = selectedIds.includes(id)
      ? selectedIds.filter(selectedId => selectedId !== id)
      : [...selectedIds, id];
    onSelectionChange(newSelection);
  };

  return (
    <View style={styles.container}>
      <AppText style={styles.label}>
        {label}
        {required && <AppText style={styles.required}> *</AppText>}
      </AppText>
      <View style={styles.optionsContainer}>
        {options.map((option) => (
          <TouchableOpacity
            key={option.id}
            style={styles.option}
            onPress={() => handleToggle(option.id)}
            activeOpacity={0.7}
          >
            <View style={[styles.checkbox, selectedIds.includes(option.id) && styles.checkboxSelected]}>
              {selectedIds.includes(option.id) && (
                <Ionicons name="checkmark" size={16} color="#FFFFFF" />
              )}
            </View>
            <AppText style={styles.optionText}>{option.label}</AppText>
          </TouchableOpacity>
        ))}
      </View>
      {error && <AppText style={styles.errorText}>{error}</AppText>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  label: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 12,
  },
  required: {
    color: '#FF6B6B',
  },
  optionsContainer: {
    gap: 12,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#8E8E93',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  optionText: {
    color: '#FFFFFF',
    fontSize: 16,
    flex: 1,
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: 14,
    marginTop: 4,
  },
});

export default CheckboxGroup; 