import { useCallback, useRef, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';

interface TabItem {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  route: string;
}

const tabs: TabItem[] = [
  { icon: 'home-outline', label: 'Inicio', route: '/(protected)/map' },
  { icon: 'search-outline', label: 'Buscar', route: '/search' },
  { icon: 'heart-outline', label: 'Favoritos', route: '/favorites' },
  { icon: 'person-outline', label: 'Profile', route: '/profile' },
];

const BottomTabBar = () => {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const [containerWidth, setContainerWidth] = useState(0);
  const H_PADDING = 16; // must match styles.container.paddingHorizontal
  
  // Animation values for each tab
  const tabAnimations = useRef<Record<string, Animated.Value>>({
    '/(protected)/map': new Animated.Value(1),
    '/search': new Animated.Value(1),
    '/favorites': new Animated.Value(1),
    '/profile': new Animated.Value(1),
  }).current;

  const handleTabPress = useCallback((route: string) => {
    // Animate the pressed tab
    Animated.sequence([
      Animated.timing(tabAnimations[route], {
        toValue: 0.8,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(tabAnimations[route], {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    router.push(route as any);
  }, [router, tabAnimations]);

  const isActiveTab = useCallback((route: string) => {
    // Special handling for map route
    if (route === '/(protected)/map') {
      return pathname === '/(protected)/map' || pathname === '/map';
    }
    // Check if current pathname matches the tab route
    return pathname === route || pathname.includes(route.replace('/', ''));
  }, [pathname]);

  // Animated indicator position
  const indicatorX = useRef(new Animated.Value(0)).current;

  const getActiveIndex = useCallback(() => {
    const index = tabs.findIndex((t) => {
      if (t.route === '/(protected)/map') {
        return pathname === '/(protected)/map' || pathname === '/map';
      }
      return pathname === t.route || pathname.includes(t.route.replace('/', ''));
    });
    return Math.max(0, index);
  }, [pathname]);

  // Animate active indicator when tab changes
  useEffect(() => {
    tabs.forEach(({ route }) => {
      const isActive = isActiveTab(route);
      const animation = tabAnimations[route];
      
      if (isActive) {
        Animated.spring(animation, {
          toValue: 1,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }).start();
      }
    });
    if (containerWidth > 0) {
      const contentWidth = Math.max(0, containerWidth - H_PADDING * 2);
      const tabWidth = contentWidth / tabs.length;
      const targetX = H_PADDING + getActiveIndex() * tabWidth;
      Animated.spring(indicatorX, {
        toValue: targetX,
        tension: 120,
        friction: 12,
        useNativeDriver: true,
      }).start();
    }
  }, [pathname, isActiveTab, tabAnimations, containerWidth, getActiveIndex, indicatorX, H_PADDING]);

  const renderTab = useCallback(({ icon, label, route }: TabItem) => {
    const isActive = isActiveTab(route);
    const iconColor = isActive ? '#FFFFFF' : '#A3B3CC';
    const textColor = isActive ? '#FFFFFF' : '#A3B3CC';
    const animation = tabAnimations[route];
    
    return (
      <Animated.View
        key={route}
        style={[
          styles.tab,
          {
            transform: [{ scale: animation }],
          },
        ]}
      >
        <TouchableOpacity
          style={styles.tabButton}
          onPress={() => handleTabPress(route)}
          activeOpacity={0.7}
        >
          <View style={[styles.iconContainer, isActive && styles.iconContainerActive]}
          >
            <Ionicons name={icon} size={18} color={iconColor} />
          </View>
          <Text style={[styles.tabLabel, { color: textColor }]}>{label}</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  }, [handleTabPress, isActiveTab, tabAnimations]);

  return (
    <View
      style={[
        styles.container,
        { paddingBottom: Math.max(insets.bottom, Platform.OS === 'ios' ? 20 : 8) }
      ]}
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
    >
      {/* Hidden for now: active background pill caused visual artifacts on some devices */}
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
    backgroundColor: '#0F1724',
    paddingTop: 6,
    paddingHorizontal: 16,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  activeIndicator: {
    position: 'absolute',
    bottom: 10,
    height: 40,
    backgroundColor: '#162235',
    borderRadius: 12,
    zIndex: 0,
    display: 'none',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    position: 'relative',
    zIndex: 1,
  },
  tabButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  tabLabel: {
    fontSize: 9,
    fontWeight: '600',
    marginTop: 3,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  iconContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  iconContainerActive: {
    backgroundColor: 'rgba(25, 118, 210, 0.16)',
  },

});

export default BottomTabBar; 