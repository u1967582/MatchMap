import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface RadioOption {
  id: string;
  label: string;
}

interface RadioGroupProps {
  label: string;
  options: RadioOption[];
  selectedId: string | null;
  onSelectionChange: (selectedId: string) => void;
  required?: boolean;
  error?: string;
}

const RadioGroup: React.FC<RadioGroupProps> = ({
  label,
  options,
  selectedId,
  onSelectionChange,
  required = false,
  error,
}) => {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>
        {label}
        {required && <Text style={styles.required}> *</Text>}
      </Text>
      <View style={styles.optionsContainer}>
        {options.map((option) => (
          <TouchableOpacity
            key={option.id}
            style={styles.option}
            onPress={() => onSelectionChange(option.id)}
            activeOpacity={0.7}
          >
            <View style={styles.radioContainer}>
              <View style={[styles.radio, selectedId === option.id && styles.radioSelected]}>
                {selectedId === option.id && <View style={styles.radioInner} />}
              </View>
            </View>
            <Text style={styles.optionText}>{option.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
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
  radioContainer: {
    marginRight: 12,
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#8E8E93',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: '#007AFF',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#007AFF',
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

export default RadioGroup; 