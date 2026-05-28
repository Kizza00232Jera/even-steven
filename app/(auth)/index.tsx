import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { signInWithGoogle } from '../../lib/auth';
import { Colors } from '../../constants/colors';

const BG = '#0b0b0b';

export default function SignInScreen() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Subtle entrance animation
  const wordmarkOpacity = useRef(new Animated.Value(0)).current;
  const wordmarkY       = useRef(new Animated.Value(16)).current;
  const taglineOpacity  = useRef(new Animated.Value(0)).current;
  const buttonOpacity   = useRef(new Animated.Value(0)).current;
  const glowOpacity     = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const ease = Easing.out(Easing.cubic);
    Animated.sequence([
      Animated.timing(glowOpacity, { toValue: 0.07, duration: 800, easing: ease, useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(wordmarkOpacity, { toValue: 1, duration: 500, easing: ease, useNativeDriver: true }),
        Animated.timing(wordmarkY,       { toValue: 0, duration: 500, easing: ease, useNativeDriver: true }),
      ]),
      Animated.timing(taglineOpacity, { toValue: 1, duration: 400, easing: ease, useNativeDriver: true }),
      Animated.timing(buttonOpacity,  { toValue: 1, duration: 400, easing: ease, useNativeDriver: true }),
    ]).start();
  }, []);

  async function handleSignIn() {
    setIsLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Sign-in failed';
      if (!msg.includes('cancelled') && !msg.includes('SIGN_IN_CANCELLED')) {
        setError('Sign-in failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.root}>
      {/* Ambient glow */}
      <Animated.View style={[styles.glow, { opacity: glowOpacity }]} />

      <View style={styles.inner}>
        {/* Wordmark — mirrors the splash animation */}
        <Animated.View
          style={[
            styles.wordmarkArea,
            { opacity: wordmarkOpacity, transform: [{ translateY: wordmarkY }] },
          ]}
        >
          <View style={styles.wordmark}>
            <Text style={styles.wordEven}>Even</Text>

            {/* The "=" dot pair — the app's identity mark */}
            <View style={styles.dotPair}>
              <View style={styles.dot} />
              <View style={styles.dot} />
            </View>

            <Text style={styles.wordSteven}>Steven</Text>
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Tagline */}
          <Animated.Text style={[styles.tagline, { opacity: taglineOpacity }]}>
            Split expenses. Stay friends.
          </Animated.Text>
        </Animated.View>

        {/* Sign-in button */}
        <Animated.View style={[styles.buttonArea, { opacity: buttonOpacity }]}>
          {error && (
            <Text style={styles.errorText}>{error}</Text>
          )}

          <TouchableOpacity
            onPress={handleSignIn}
            disabled={isLoading}
            testID="google-signin-button"
            accessibilityRole="button"
            accessibilityLabel="Sign in with Google"
            activeOpacity={0.85}
            style={[styles.googleButton, isLoading && styles.googleButtonDisabled]}
          >
            {isLoading ? (
              <ActivityIndicator color={BG} />
            ) : (
              <View style={styles.googleButtonInner}>
                {/* Google "G" monogram */}
                <View style={styles.gIcon}>
                  <Text style={styles.gIconText}>G</Text>
                </View>
                <Text style={styles.googleButtonText}>Continue with Google</Text>
              </View>
            )}
          </TouchableOpacity>

          <Text style={styles.legalNote}>
            By continuing you agree to our Terms of Service and Privacy Policy.
          </Text>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },
  glow: {
    position: 'absolute',
    top: -160,
    left: '50%',
    marginLeft: -240,
    width: 480,
    height: 480,
    borderRadius: 240,
    backgroundColor: Colors.accent,
  },
  inner: {
    flex: 1,
    paddingHorizontal: 32,
    justifyContent: 'space-between',
    paddingTop: 80,
    paddingBottom: 48,
  },

  // ── Wordmark ──────────────────────────────────────────────────────────────
  wordmarkArea: {
    alignItems: 'center',
    marginTop: 40,
  },
  wordmark: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  wordEven: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 48,
    color: '#ffffff',
    letterSpacing: -1.5,
  },
  dotPair: {
    gap: 6,
    alignItems: 'center',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: Colors.accent,
  },
  wordSteven: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 48,
    color: Colors.accent,
    letterSpacing: -1.5,
  },
  divider: {
    marginTop: 20,
    width: 160,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  tagline: {
    marginTop: 16,
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    color: 'rgba(255,255,255,0.38)',
    letterSpacing: 0.2,
    textAlign: 'center',
  },

  // ── Button area ───────────────────────────────────────────────────────────
  buttonArea: {
    gap: 16,
  },
  errorText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: Colors.destructive,
    textAlign: 'center',
    marginBottom: 4,
  },
  googleButton: {
    backgroundColor: '#ffffff',
    borderRadius: 100,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  googleButtonDisabled: {
    opacity: 0.6,
  },
  googleButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  gIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#4285F4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gIconText: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 13,
    color: '#ffffff',
    lineHeight: 16,
  },
  googleButtonText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 16,
    color: '#1a1a1a',
    letterSpacing: 0.1,
  },
  legalNote: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: 'rgba(255,255,255,0.22)',
    textAlign: 'center',
    lineHeight: 16,
  },
});
