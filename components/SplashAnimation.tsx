import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { Colors } from '../constants/colors';

interface Props {
  onFinished: () => void;
}

export function SplashAnimation({ onFinished }: Props) {
  const evenOpacity = useRef(new Animated.Value(0)).current;
  const evenX = useRef(new Animated.Value(-24)).current;
  const stevenOpacity = useRef(new Animated.Value(0)).current;
  const stevenX = useRef(new Animated.Value(24)).current;
  const lineScale = useRef(new Animated.Value(0)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const containerOpacity = useRef(new Animated.Value(1)).current;
  const dotScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const ease = Easing.out(Easing.cubic);

    Animated.sequence([
      // 1. Accent dot pulses in from center
      Animated.spring(dotScale, { toValue: 1, useNativeDriver: true, tension: 80, friction: 6 }),

      // 2. "Even" slides in from left, "Steven" from right, simultaneously
      Animated.parallel([
        Animated.timing(evenOpacity, { toValue: 1, duration: 380, easing: ease, useNativeDriver: true }),
        Animated.timing(evenX, { toValue: 0, duration: 380, easing: ease, useNativeDriver: true }),
        Animated.timing(stevenOpacity, { toValue: 1, duration: 380, easing: ease, useNativeDriver: true }),
        Animated.timing(stevenX, { toValue: 0, duration: 380, easing: ease, useNativeDriver: true }),
      ]),

      // 3. Separator line expands outward
      Animated.timing(lineScale, { toValue: 1, duration: 280, easing: ease, useNativeDriver: true }),

      // 4. Tagline fades in
      Animated.timing(taglineOpacity, { toValue: 1, duration: 300, easing: ease, useNativeDriver: true }),

      // 5. Hold
      Animated.delay(620),

      // 6. Fade out everything
      Animated.timing(containerOpacity, { toValue: 0, duration: 320, easing: Easing.in(Easing.quad), useNativeDriver: true }),
    ]).start(() => onFinished());
  }, []);

  return (
    <Animated.View style={[styles.container, { opacity: containerOpacity }]}>
      {/* Background glow */}
      <Animated.View
        style={[
          styles.glowDot,
          {
            transform: [{ scale: dotScale }],
            opacity: dotScale.interpolate({ inputRange: [0, 1], outputRange: [0, 0.12] }),
          },
        ]}
      />

      {/* Wordmark row */}
      <View style={styles.wordmark}>
        <Animated.Text
          style={[
            styles.wordEven,
            {
              opacity: evenOpacity,
              transform: [{ translateX: evenX }],
            },
          ]}
        >
          Even
        </Animated.Text>

        {/* Accent dot — the "=" of Even Steven */}
        <Animated.View
          style={[
            styles.dotContainer,
            { transform: [{ scale: dotScale }] },
          ]}
        >
          <View style={styles.dotUpper} />
          <View style={styles.dotLower} />
        </Animated.View>

        <Animated.Text
          style={[
            styles.wordSteven,
            {
              opacity: stevenOpacity,
              transform: [{ translateX: stevenX }],
            },
          ]}
        >
          Steven
        </Animated.Text>
      </View>

      {/* Separator line */}
      <Animated.View style={[styles.lineWrapper, { transform: [{ scaleX: lineScale }] }]}>
        <View style={styles.line} />
      </Animated.View>

      {/* Tagline */}
      <Animated.Text style={[styles.tagline, { opacity: taglineOpacity }]}>
        Split expenses. Stay friends.
      </Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0b0b0b',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  glowDot: {
    position: 'absolute',
    width: 480,
    height: 480,
    borderRadius: 240,
    backgroundColor: Colors.accent,
  },
  wordmark: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  wordEven: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 42,
    color: '#ffffff',
    letterSpacing: -1,
  },
  dotContainer: {
    gap: 5,
    alignItems: 'center',
  },
  dotUpper: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.accent,
  },
  dotLower: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.accent,
  },
  wordSteven: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 42,
    color: Colors.accent,
    letterSpacing: -1,
  },
  lineWrapper: {
    marginTop: 16,
    width: 200,
  },
  line: {
    height: 1.5,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  tagline: {
    marginTop: 16,
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 0.2,
  },
});
