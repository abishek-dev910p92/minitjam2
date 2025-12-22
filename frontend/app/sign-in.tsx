import React, { useState } from 'react';
import {
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    ActivityIndicator,
    Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import useAuthStore from './_utils/authStore';
import apiEndpoints from './api/baseUrl';

export default function SignIn() {
  const { login } = useAuthStore();
  const { resetOnboarding } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isClubLogin, setIsClubLogin] = useState(false);

  const handleLogin = async () => {
    // Basic validation
    if (!email || !password) {
      Alert.alert('Error', 'Email and password are required.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(apiEndpoints.login, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
          role: isClubLogin ? 'club' : 'artist',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Login failed. Please check your credentials.');
      }

      // Use the new secure login method
      await login(data.token, data.refreshToken, data.user, isClubLogin ? 'club' : 'artist');

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(errorMessage);
      Alert.alert('Login Failed', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.rootContainer, isClubLogin && styles.rootContainerClub]}>
      <StatusBar style="light" />
      
      {/* Club/Artist Toggle */}
      <View style={styles.toggleContainer}>
        <TouchableOpacity 
          style={[styles.toggleButton, !isClubLogin && styles.toggleButtonActive]}
          onPress={() => setIsClubLogin(false)}
        >
          <Text style={[styles.toggleButtonText, !isClubLogin && styles.toggleButtonTextActive]}>
            Artist
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.toggleButton, isClubLogin && styles.toggleButtonActive]}
          onPress={() => setIsClubLogin(true)}
        >
          <Text style={[styles.toggleButtonText, isClubLogin && styles.toggleButtonTextActive]}>
            Club
          </Text>
        </TouchableOpacity>
      </View>
      
      {/* Conditional background image based on role */}
      <Image
        source={isClubLogin 
          ? require('../assets/images/bg header.png') 
          : require('../assets/images/slider1.png')
        }
        style={styles.heroImage}
      />
      
      {/* 2. SafeAreaView now only wraps the scrollable content */}
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
          {/* This empty view creates the space the image visually occupies */}
          <View style={styles.imageSpacer} />

          <View style={[styles.contentContainer, isClubLogin && styles.contentContainerClub]}>
            <Text style={[styles.title, isClubLogin && styles.titleClub]}>
              {isClubLogin ? 'Welcome to Club Hub!' : 'Welcome Back!'}
            </Text>
            <Text style={[styles.subtitle, isClubLogin && styles.subtitleClub]}>
              {isClubLogin 
                ? 'Sign in to manage your venue and connect with artists.' 
                : 'Sign in to find your next gig.'
              }
            </Text>

            <View style={styles.inputContainer}>
              <TextInput
                style={[styles.input, isClubLogin && styles.inputClub]}
                placeholder="Email address"
                placeholderTextColor={isClubLogin ? "#A8A29E" : "#A8A29E"}
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
              />
              <TextInput
                style={[styles.input, isClubLogin && styles.inputClub]}
                placeholder="Password"
                placeholderTextColor={isClubLogin ? "#A8A29E" : "#A8A29E"}
                secureTextEntry={true}
                value={password}
                onChangeText={setPassword}
              />
              <TouchableOpacity 
                style={styles.forgotPasswordButton}
                onPress={() => router.push('/forgot-password')}
              >
                <Text style={[styles.forgotPassword, isClubLogin && styles.forgotPasswordClub]}>
                  Forgot Password?
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.buttonContainer}>
              <TouchableOpacity 
                style={[styles.signInButton, isClubLogin && styles.signInButtonClub, loading && styles.buttonDisabled]}
                onPress={handleLogin} 
                activeOpacity={0.8}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={[styles.signInButtonText, isClubLogin && styles.signInButtonTextClub]}>
                    {isClubLogin ? 'Sign In as Club' : 'Sign In'}
                  </Text>
                )}
              </TouchableOpacity>
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
            </View>
          </View>

            <TouchableOpacity 
              onPress={() => {
                resetOnboarding();
                router.push(isClubLogin ? '/club-signup' : '/onboarding/final');
              }}
            >
              <View style={styles.signUpPromptContainer}>
                <Text style={[styles.signUpText, isClubLogin && styles.signUpTextClub]}>
                  Don't have an account? <Text style={[styles.signUpLink, isClubLogin && styles.signUpLinkClub]}>Sign Up</Text>
                </Text>
              </View>
            </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: '#f3ede6',
  },
  rootContainerClub: {
    backgroundColor: '#1a1a1a',
  },
  toggleContainer: {
    position: 'absolute',
    top: 50,
    left: 24,
    right: 24,
    zIndex: 10,
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 25,
    padding: 4,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 21,
    alignItems: 'center',
  },
  toggleButtonActive: {
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  toggleButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  toggleButtonTextActive: {
    color: '#000000',
  },
  heroImage: {
    width: '100%',
    height: 300,
    position: 'absolute',
    top: 0,
    left: 0,
    resizeMode: 'cover',
  },
  safeArea: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
  },
  imageSpacer: {
    height: 220,
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 24,
    backgroundColor: '#f3ede6',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingTop: 40,
  },
  contentContainerClub: {
    backgroundColor: '#2a2a2a',
  },
  title: {
    color: '#16120f',
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  titleClub: {
    color: '#d4af37',
  },
  subtitle: {
    color: '#78716C',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  subtitleClub: {
    color: '#cccccc',
  },
  inputContainer: {
    marginTop: 20,
  },
  input: {
    backgroundColor: '#FFFFFF',
    height: 56,
    borderRadius: 12,
    paddingHorizontal: 20,
    fontSize: 16,
    color: '#16120f',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E7E5E4',
  },
  inputClub: {
    backgroundColor: '#1a1a1a',
    color: '#ffffff',
    borderColor: '#333333',
  },
  forgotPasswordButton: {
    alignItems: 'flex-end',
    marginBottom: 20,
  },
  forgotPassword: {
    color: '#16120f',
    fontSize: 14,
    textAlign: 'right',
    textDecorationLine: 'underline',
  },
  forgotPasswordClub: {
    color: '#d4af37',
  },
  buttonContainer: {
    marginTop: 10,
  },
  signInButton: {
    backgroundColor: '#16120f',
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  signInButtonClub: {
    backgroundColor: '#d4af37',
  },
  signInButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  signInButtonTextClub: {
    color: '#000000',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  errorText: {
    color: '#ff4444',
    textAlign: 'center',
    marginTop: 10,
    fontSize: 14,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E7E5E4',
  },
  dividerText: {
    marginHorizontal: 10,
    color: '#A8A29E',
  },
  socialButton: {
    backgroundColor: 'white',
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E7E5E4',
  },
  socialButtonText: {
    color: '#16120f',
    fontSize: 16,
    fontWeight: 'bold',
  },
  signUpPromptContainer: {
    paddingVertical: 20,
    alignItems: 'center',
    backgroundColor: '#f3ede6',
  },
  signUpText: {
    color: '#78716C',
    fontSize: 14,
  },
  signUpTextClub: {
    color: '#cccccc',
  },
  signUpLink: {
    color: '#16120f',
    fontWeight: 'bold',
    textDecorationLine: 'underline',
  },
  signUpLinkClub: {
    color: '#d4af37',
  },
});
