import { TextInput, StyleSheet, KeyboardTypeOptions, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';

interface InputFieldProps {
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoCorrect?: boolean;
  editable?: boolean;
  multiline?: boolean;
  numberOfLines?: number;
  maxLength?: number;
  theme?: 'light' | 'dark';
}

const InputField: React.FC<InputFieldProps> = ({
  placeholder,
  value,
  onChangeText,
  secureTextEntry = false,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  autoCorrect = true,
  editable = true,
  multiline = false,
  numberOfLines = 1,
  maxLength,
  theme = 'light',
}) => {
  const [showPassword, setShowPassword] = useState(false);

  const inputStyle = [
    styles.input,
    theme === 'dark' ? styles.darkInput : styles.lightInput,
    secureTextEntry && styles.passwordInput,
  ];

  const placeholderColor = theme === 'dark' ? '#8E8E93' : '#999';

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const shouldShowPasswordToggle = secureTextEntry;
  const isPasswordVisible = showPassword;

  return (
    <View style={styles.container}>
      <TextInput
        style={inputStyle}
        placeholder={placeholder}
        placeholderTextColor={placeholderColor}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry && !isPasswordVisible}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        editable={editable}
        multiline={multiline}
        numberOfLines={numberOfLines}
        maxLength={maxLength}
      />
      {shouldShowPasswordToggle && (
        <TouchableOpacity
          style={styles.passwordToggle}
          onPress={togglePasswordVisibility}
          activeOpacity={0.7}
        >
          <Ionicons
            name={isPasswordVisible ? 'eye-off' : 'eye'}
            size={20}
            color={theme === 'dark' ? '#8E8E93' : '#666'}
          />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    marginBottom: 16,
  },
  input: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    minHeight: 50,
  },
  lightInput: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#ddd',
    color: '#000',
  },
  darkInput: {
    backgroundColor: '#3A4A5C',
    borderWidth: 0,
    color: '#FFFFFF',
  },
  passwordInput: {
    paddingRight: 50, // Extra padding for the eye icon
  },
  passwordToggle: {
    position: 'absolute',
    right: 16,
    top: 15,
    padding: 5,
  },
});

export default InputField; 