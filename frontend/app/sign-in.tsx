import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import {
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import useAuthStore from './_utils/authStore';
import apiEndpoints from './api/baseUrl';

export default function SignIn() {
  const { login } = useAuthStore();
  const {resetOnboarding} = useAuthStore();
  // State variables for form inputs and UI feedback
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    // Basic validation
    if (!email || !password) {
      setError('Email and password are required.');
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
        role: 'artist',
      }),
    });

        const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Login failed. Please check your credentials.');
    }

    // Success! Store the token and user data in AsyncStorage.
    await AsyncStorage.setItem('userToken', data.token);
    await AsyncStorage.setItem('userData', JSON.stringify(data.user));

    // Call your global login function (if it handles other state logic).
    // The useAuthStore login function should ideally read from AsyncStorage to hydrate the app's state.
    // For now, let's keep your original line.
    login(); // Call login without arguments since the store will read from AsyncStorage

  } catch (err) {
    setError(err instanceof Error ? err.message : 'An unexpected error occurred');
  //  console.error('Login error:', err);
  } finally {
    setLoading(false);
  }
};

  return (
    <View style={styles.rootContainer}>
      <StatusBar style="light" />
      {/* 1. Image is now absolute, positioned as the background layer */}
      <Image
        source={require('../assets/images/slider1.png')}
        style={styles.heroImage}
      />
      
      {/* 2. SafeAreaView now only wraps the scrollable content */}
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
          {/* This empty view creates the space the image visually occupies */}
          <View style={styles.imageSpacer} />

          <View style={styles.contentContainer}>
            <Text style={styles.title}>Welcome Back!</Text>
            <Text style={styles.subtitle}>Sign in to find your next gig.</Text>

            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Email address"
                placeholderTextColor="#A8A29E"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
              />
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor="#A8A29E"
                secureTextEntry={true}
                value={password}
                onChangeText={setPassword}
              />
              <TouchableOpacity>
                <Text style={styles.forgotPassword}>Forgot Password?</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.buttonContainer}>
              <TouchableOpacity 
                style={[styles.signInButton, loading && { opacity: 0.5 }]}
                onPress={handleLogin} 
                activeOpacity={0.8}
                disabled={loading}
              >
                <Text style={styles.signInButtonText}>
                  {loading ? 'Signing In...' : 'Sign In'}
                </Text>
              </TouchableOpacity>
              {error ? <Text style={{ color: 'red', textAlign: 'center', marginTop: 10 }}>{error}</Text> : null}
            </View>
          </View>

            <TouchableOpacity onPress={resetOnboarding}>
          <View style={styles.signUpPromptContainer}>
              <Text style={styles.signUpText}>
              Don&apos;t have an account? <Text style={styles.signUpLink}>Sign Up</Text>
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
  heroImage: {
    width: '100%',
    height: 300, // Slightly larger height for the immersive effect
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
    height: 220, // This empty space pushes the content down, revealing the image
  },
  contentContainer: {
    flex: 1, // Ensures it takes up the rest of the space
    paddingHorizontal: 24,
    backgroundColor: '#f3ede6',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingTop: 40,
  },
  title: {
    color: '#16120f',
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  subtitle: {
    color: '#78716C',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
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
  forgotPassword: {
    color: '#16120f',
    fontSize: 14,
    textAlign: 'right',
    textDecorationLine: 'underline',
    marginBottom: 20,
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
  signInButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
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
  signUpLink: {
    color: '#16120f',
    fontWeight: 'bold',
    textDecorationLine: 'underline',
  },
});