import { useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

interface TabItem {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  route: string;
}

const tabs: TabItem[] = [
  { icon: 'home', label: 'Inicio', route: '/home' },
  { icon: 'search', label: 'Buscar', route: '/search' },
  { icon: 'heart', label: 'Favoritos', route: '/favorites' },
  { icon: 'user', label: 'Profile', route: '/profile' },
];

const BottomTabBar = () => {
  const router = useRouter();

  const handleTabPress = useCallback((route: string) => {
    router.push(route as any);
  }, [router]);

  const renderTab = useCallback(({ icon, label, route }: TabItem) => (
    <TouchableOpacity
      key={route}
      style={styles.tab}
      onPress={() => handleTabPress(route)}
      activeOpacity={0.7}
    >
      <Feather name={icon} size={24} color="#A3B3CC" />
      <Text style={styles.tabLabel}>{label}</Text>
    </TouchableOpacity>
  ), [handleTabPress]);

  return (
    <View style={styles.container}>
      {tabs.map(renderTab)}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    backgroundColor: '#112233',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: '#2A3A4A',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  tabLabel: {
    color: '#A3B3CC',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
    textAlign: 'center',
  },
});

export default BottomTabBar; 