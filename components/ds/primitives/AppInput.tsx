import { useState } from 'react';
import {
  View,
  TextInput,
  TextInputProps,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AppText from './AppText';
import { colors } from '../tokens/colors';
import { radius } from '../tokens/radius';
import { spacing } from '../tokens/spacing';
import { typography } from '../tokens/typography';

interface AppInputProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  helperText?: string;
  error?: string;
  secureTextEntry?: boolean;
}

export default function AppInput({
  label,
  helperText,
  error,
  secureTextEntry = false,
  ...rest
}: AppInputProps) {
  const [showPassword, setShowPassword] = useState(false);
  const hasError = !!error;

  return (
    <View style={styles.container}>
      {label && (
        <AppText variant="label" style={styles.label}>
          {label}
        </AppText>
      )}

      <View style={styles.inputWrapper}>
        <TextInput
          style={[
            styles.input,
            hasError && styles.inputError,
            secureTextEntry && styles.inputWithToggle,
          ]}
          placeholderTextColor={colors.text.muted}
          secureTextEntry={secureTextEntry && !showPassword}
          {...rest}
        />
        {secureTextEntry && (
          <TouchableOpacity
            style={styles.toggle}
            onPress={() => setShowPassword(!showPassword)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={showPassword ? 'eye-off' : 'eye'}
              size={20}
              color={colors.text.muted}
            />
          </TouchableOpacity>
        )}
      </View>

      {(error || helperText) && (
        <AppText
          variant="caption"
          color={hasError ? colors.status.error : colors.text.muted}
          style={styles.helperText}
        >
          {error || helperText}
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.lg,
  },
  label: {
    marginBottom: spacing.sm,
  },
  inputWrapper: {
    position: 'relative',
  },
  input: {
    backgroundColor: colors.bg.input,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingVertical: Platform.OS === 'android' ? spacing.md : spacing.lg,
    fontSize: typography.size.button,
    color: colors.text.primary,
    minHeight: Platform.OS === 'android' ? 48 : 50,
    ...(Platform.OS === 'android' && {
      textAlignVertical: 'center',
      includeFontPadding: false,
    }),
  },
  inputError: {
    borderWidth: 1,
    borderColor: colors.status.error,
  },
  inputWithToggle: {
    paddingRight: 50,
  },
  toggle: {
    position: 'absolute',
    right: spacing.lg,
    top: 15,
    padding: 5,
  },
  helperText: {
    marginTop: spacing.xs,
  },
});
