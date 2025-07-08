import { Text, StyleSheet } from 'react-native';

interface ScreenTitleProps {
  title: string;
  color?: string;
  fontSize?: number;
  textAlign?: 'left' | 'center' | 'right';
  marginBottom?: number;
  shadow?: boolean;
}

const ScreenTitle: React.FC<ScreenTitleProps> = ({
  title,
  color = 'white',
  fontSize = 32,
  textAlign = 'center',
  marginBottom = 60,
  shadow = true,
}) => {
  const titleStyle = [
    styles.title,
    {
      color,
      fontSize,
      textAlign,
      marginBottom,
      ...(shadow && styles.shadow),
    },
  ];

  return <Text style={titleStyle}>{title}</Text>;
};

const styles = StyleSheet.create({
  title: {
    fontWeight: 'bold',
    lineHeight: 38,
  },
  shadow: {
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
});

export default ScreenTitle; 