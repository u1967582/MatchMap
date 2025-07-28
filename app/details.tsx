import { Stack, useLocalSearchParams } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';

import { Container } from '~/components/Container';

export default function Details() {
  const { name } = useLocalSearchParams();

  return (
    <>
      <Stack.Screen options={{ title: 'Details' }} />
      <Container>
        <View style={styles.container}>
          <Text style={styles.title}>Showing details for user {name}</Text>
          <View style={styles.separator} />
          <Text style={styles.description}>
            This is a details screen for the user: {name}
          </Text>
        </View>
      </Container>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  separator: {
    backgroundColor: '#d1d5db',
    height: 1,
    width: '80%',
    marginVertical: 30,
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    color: '#666',
  },
});
