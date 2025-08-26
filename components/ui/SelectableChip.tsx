import { useState, useRef } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
} from 'react-native';

interface SelectableChipProps {
  icon: string;
  label: string;
  selected: boolean;
  onPress: () => void;
}

export default function SelectableChip({
  icon,
  label,
  selected,
  onPress,
}: SelectableChipProps) {
  console.log('🎨 SelectableChip render:', { icon, label, selected });
  
  return (
    <TouchableOpacity
      style={[
        styles.chip,
        selected && styles.chipSelected
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={styles.icon}>{icon}</Text>
      <Text style={[
        styles.label,
        selected && styles.labelSelected
      ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#243243',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#3B4B5B',
    minWidth: 90,
    minHeight: 44,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  chipSelected: {
    backgroundColor: '#1976D2',
    borderColor: '#1976D2',
    shadowColor: '#1976D2',
    shadowOpacity: 0.4,
  },
  icon: {
    fontSize: 18,
    marginRight: 8,
  },
  label: {
    color: '#A3B3CC',
    fontSize: 14,
    fontWeight: '600',
  },
  labelSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
}); 