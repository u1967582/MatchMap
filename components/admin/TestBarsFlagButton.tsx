import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '~/components/ds';
import { useTestBarsVisibilityStore } from '~/stores/testBarsVisibilityStore';

export function TestBarsFlagButton() {
  const showTestBars = useTestBarsVisibilityStore((state) => state.showTestBars);
  const toggleShowTestBars = useTestBarsVisibilityStore((state) => state.toggleShowTestBars);

  return (
    <TouchableOpacity onPress={toggleShowTestBars} style={styles.button} activeOpacity={0.7}>
      <Ionicons
        name={showTestBars ? 'flag' : 'flag-outline'}
        size={22}
        color={showTestBars ? colors.brand.primary : colors.text.muted}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    padding: spacing.xs,
  },
});
