import React from 'react';
import { TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { AppText } from '~/components/ds';

interface CustomButtonProps {
  text: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'dark' | 'social';
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
}

const CustomButton: React.FC<CustomButtonProps> = ({
  text,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  fullWidth = true,
}) => {
  const getButtonStyle = () => {
    const baseStyle = [styles.button];
    
    if (fullWidth) baseStyle.push(styles.fullWidth);
    if (disabled || loading) baseStyle.push(styles.disabled);
    
    switch (variant) {
      case 'primary':
        baseStyle.push(styles.primary);
        break;
      case 'secondary':
        baseStyle.push(styles.secondary);
        break;
      case 'outline':
        baseStyle.push(styles.outline);
        break;
      case 'dark':
        baseStyle.push(styles.dark);
        break;
      case 'social':
        baseStyle.push(styles.social);
        break;
    }
    
    return baseStyle;
  };

  const getTextStyle = () => {
    const baseStyle = [styles.buttonText];
    
    switch (variant) {
      case 'primary':
        baseStyle.push(styles.primaryText);
        break;
      case 'secondary':
        baseStyle.push(styles.secondaryText);
        break;
      case 'outline':
        baseStyle.push(styles.outlineText);
        break;
      case 'dark':
        baseStyle.push(styles.darkText);
        break;
      case 'social':
        baseStyle.push(styles.socialText);
        break;
    }
    
    return baseStyle;
  };

  const getLoadingColor = () => {
    switch (variant) {
      case 'primary':
      case 'dark':
        return '#FFFFFF';
      case 'secondary':
      case 'outline':
      case 'social':
        return '#8E8E93';
      default:
        return '#FFFFFF';
    }
  };

  return (
    <TouchableOpacity
      style={getButtonStyle()}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator color={getLoadingColor()} size="small" />
      ) : (
        <AppText maxScale={1.0} style={getTextStyle()}>{text}</AppText>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.6,
  },
  primary: {
    backgroundColor: '#007AFF',
  },
  secondary: {
    backgroundColor: '#1E2A38',
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#CDE6FF',
  },
  dark: {
    backgroundColor: '#3A4A5C',
  },
  social: {
    backgroundColor: '#2C3E50',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  primaryText: {
    color: '#FFFFFF',
  },
  secondaryText: {
    color: '#CDE6FF',
  },
  outlineText: {
    color: '#CDE6FF',
  },
  darkText: {
    color: '#FFFFFF',
  },
  socialText: {
    color: '#FFFFFF',
  },
});

export default CustomButton; 