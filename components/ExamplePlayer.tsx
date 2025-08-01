import React, { useRef, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

const ExamplePlayer: React.FC = () => {
  const [currentTime, setCurrentTime] = useState(3);
  const [totalTime, setTotalTime] = useState(4);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeTab, setActiveTab] = useState('discover');
  
  // Animation values
  const progressAnimation = useRef(new Animated.Value(0)).current;
  const centralBarScale = useRef(new Animated.Value(1)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;
  const playButtonScale = useRef(new Animated.Value(1)).current;

  // Progress animation
  useEffect(() => {
    const progress = currentTime / totalTime;
    Animated.timing(progressAnimation, {
      toValue: progress,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [currentTime, totalTime]);

  // Central bar floating animation
  useEffect(() => {
    const floatingAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(centralBarScale, {
          toValue: 1.02,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(centralBarScale, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    );
    floatingAnimation.start();

    return () => floatingAnimation.stop();
  }, []);

  const handleTabPress = (tab: string) => {
    setActiveTab(tab);
    
    // Button press animation
    Animated.sequence([
      Animated.timing(buttonScale, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(buttonScale, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
    
    // Play button animation
    Animated.sequence([
      Animated.timing(playButtonScale, {
        toValue: 0.9,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(playButtonScale, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const renderTabButton = (icon: string, label: string, tab: string) => {
    const isActive = activeTab === tab;
    
    return (
      <TouchableOpacity
        style={[
          styles.tabButton,
          isActive && styles.activeTabButton,
        ]}
        onPress={() => handleTabPress(tab)}
        activeOpacity={0.8}
      >
        <Animated.View
          style={[
            styles.buttonContent,
            {
              transform: [{ scale: isActive ? buttonScale : 1 }],
            },
          ]}
        >
          <Ionicons 
            name={icon as any} 
            size={20} 
            color={isActive ? '#FFFFFF' : '#666666'} 
          />
          {label && (
            <Text style={[
              styles.buttonLabel,
              { color: isActive ? '#FFFFFF' : '#666666' }
            ]}>
              {label}
            </Text>
          )}
        </Animated.View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Central Navigation Bar */}
      <Animated.View
        style={[
          styles.centralBar,
          {
            transform: [{ scale: centralBarScale }],
          },
        ]}
      >
        {renderTabButton('musical-notes', 'Discover', 'discover')}
        {renderTabButton('heart-outline', '', 'favorites')}
        {renderTabButton('person-outline', '', 'profile')}
        {renderTabButton('options-outline', '', 'settings')}
      </Animated.View>

      {/* Bottom Player Bar */}
      <View style={styles.playerBar}>
        <TouchableOpacity
          style={styles.playButton}
          onPress={handlePlayPause}
          activeOpacity={0.8}
        >
          <Animated.View
            style={{
              transform: [{ scale: playButtonScale }],
            }}
          >
            <Ionicons 
              name={isPlaying ? 'pause' : 'play'} 
              size={24} 
              color="#666666" 
            />
          </Animated.View>
        </TouchableOpacity>

        <View style={styles.timeContainer}>
          <Text style={styles.timeText}>0:0{currentTime}</Text>
          <Text style={styles.timeText}>0:0{totalTime}</Text>
        </View>

        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <Animated.View
              style={[
                styles.progressFill,
                {
                  width: progressAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                },
              ]}
            />
            <Animated.View
              style={[
                styles.progressHandle,
                {
                  left: progressAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, width - 80],
                  }),
                },
              ]}
            />
          </View>
        </View>

        <TouchableOpacity style={styles.volumeButton}>
          <Ionicons name="volume-high" size={20} color="#666666" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFE4E1', // Soft pink background
    justifyContent: 'space-between',
    paddingVertical: 100,
    paddingHorizontal: 20,
  },
  centralBar: {
    backgroundColor: '#FFFFFF',
    borderRadius: 30,
    paddingHorizontal: 20,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 20,
    marginHorizontal: 4,
  },
  activeTabButton: {
    backgroundColor: '#FF6B9D',
  },
  buttonContent: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  buttonLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  playerBar: {
    backgroundColor: '#FFFFFF',
    borderRadius: 25,
    paddingHorizontal: 20,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  playButton: {
    marginRight: 15,
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 15,
  },
  timeText: {
    fontSize: 12,
    color: '#666666',
    fontWeight: '500',
  },
  progressContainer: {
    flex: 1,
    marginRight: 15,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    position: 'relative',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FF6B9D',
    borderRadius: 2,
  },
  progressHandle: {
    position: 'absolute',
    top: -4,
    width: 12,
    height: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#FF6B9D',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  volumeButton: {
    padding: 4,
  },
});

export default ExamplePlayer; 