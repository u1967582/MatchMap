import { useState } from 'react';
import { TextInput, StyleSheet, KeyboardTypeOptions, View, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

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
  showPasswordToggle?: boolean;
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
  showPasswordToggle = false,
}) => {
  const [showPassword, setShowPassword] = useState(false);
  
  // Determine if we should show the password toggle
  const shouldShowPasswordToggle = showPasswordToggle && secureTextEntry;
  
  // Determine the actual secure text entry state
  const actualSecureTextEntry = shouldShowPasswordToggle ? !showPassword : secureTextEntry;

  const inputStyle = [
    styles.input,
    theme === 'dark' ? styles.darkInput : styles.lightInput,
    shouldShowPasswordToggle && styles.inputWithToggle,
  ];

  const placeholderColor = theme === 'dark' ? '#8E8E93' : '#999';

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={inputStyle}
        placeholder={placeholder}
        placeholderTextColor={placeholderColor}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={actualSecureTextEntry}
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
          disabled={!editable}
        >
          <Ionicons
            name={showPassword ? 'eye-off' : 'eye'}
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
  inputWithToggle: {
    paddingRight: 50, // Extra space for the toggle button
  },
  passwordToggle: {
    position: 'absolute',
    right: 16,
    top: 15, // Center vertically
    padding: 4,
  },
});

export default InputField; 