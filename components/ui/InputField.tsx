import { TextInput, StyleSheet, KeyboardTypeOptions } from 'react-native';

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
  const inputStyle = [
    styles.input,
    theme === 'dark' ? styles.darkInput : styles.lightInput,
  ];

  const placeholderColor = theme === 'dark' ? '#8E8E93' : '#999';

  return (
    <TextInput
      style={inputStyle}
      placeholder={placeholder}
      placeholderTextColor={placeholderColor}
      value={value}
      onChangeText={onChangeText}
      secureTextEntry={secureTextEntry}
      keyboardType={keyboardType}
      autoCapitalize={autoCapitalize}
      autoCorrect={autoCorrect}
      editable={editable}
      multiline={multiline}
      numberOfLines={numberOfLines}
      maxLength={maxLength}
    />
  );
};

const styles = StyleSheet.create({
  input: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    marginBottom: 16,
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
});

export default InputField; 