import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const SplashScreen = ({ navigation }) => {
  const scaleAnim = useRef(new Animated.Value(0.3)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Scale animation
    Animated.timing(scaleAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();

    // Opacity animation
    Animated.timing(opacityAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();

    // Slide animation
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 600,
      delay: 200,
      useNativeDriver: true,
    }).start();

    // Pulse animation (continuous)
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.08,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Navigate after 3 seconds
    const timer = setTimeout(() => {
      navigation.replace('Login');
    }, 3000);

    return () => clearTimeout(timer);
  }, [navigation, scaleAnim, opacityAnim, slideAnim, pulseAnim]);

  return (
    <View style={styles.container}>
      {/* Animated background gradient effect */}
      <View style={styles.backgroundGradient} />

      {/* Main content */}
      <Animated.View
        style={[
          styles.content,
          {
            transform: [{ scale: scaleAnim }, { scale: pulseAnim }],
            opacity: opacityAnim,
          },
        ]}
      >
        {/* Logo Icon */}
        <View style={styles.logoContainer}>
          <MaterialCommunityIcons
            name="heart-pulse"
            size={80}
            color="#ffffff"
          />
        </View>

        {/* App Name */}
        <Animated.Text
          style={[
            styles.appName,
            {
              opacity: opacityAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          CareMind
        </Animated.Text>

        {/* Tagline */}
        <Animated.Text
          style={[
            styles.tagline,
            {
              opacity: opacityAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          Alzheimer's Care Companion
        </Animated.Text>
      </Animated.View>

      {/* Animated dots loader */}
      <View style={styles.loaderContainer}>
        <AnimatedDot delay={0} />
        <AnimatedDot delay={200} />
        <AnimatedDot delay={400} />
      </View>

      {/* Bottom text */}
      <Animated.Text
        style={[
          styles.bottomText,
          {
            opacity: opacityAnim,
          },
        ]}
      >
        Real-time Health Monitoring
      </Animated.Text>
    </View>
  );
};

const AnimatedDot = ({ delay }) => {
  const dotAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const startDotAnimation = () => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dotAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(dotAnim, {
            toValue: 0,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      ).start();
    };

    startDotAnimation();
  }, [delay, dotAnim]);

  return (
    <Animated.View
      style={[
        styles.dot,
        {
          opacity: dotAnim,
          transform: [
            {
              scale: dotAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.5, 1],
              }),
            },
          ],
        },
      ]}
    />
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#006064',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backgroundGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#004d4d',
    opacity: 0.3,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#00acc1',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
    shadowColor: '#00acc1',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 15,
  },
  appName: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 10,
    textAlign: 'center',
  },
  tagline: {
    fontSize: 16,
    color: '#b2ebf2',
    textAlign: 'center',
    fontWeight: '300',
    letterSpacing: 1,
  },
  loaderContainer: {
    flexDirection: 'row',
    marginTop: 60,
    gap: 12,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#00acc1',
  },
  bottomText: {
    position: 'absolute',
    bottom: 40,
    fontSize: 14,
    color: '#b2ebf2',
    fontWeight: '500',
    letterSpacing: 0.5,
  },
});

export default SplashScreen;
