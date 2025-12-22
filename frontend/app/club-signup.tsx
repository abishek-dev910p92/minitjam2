import axios from "axios";
import React, { useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import useAuthStore from './_utils/authStore';
import { router } from 'expo-router';
import apiEndpoints from './api/baseUrl';
import Dropdown from './onboarding/Dropdown';

const ClubSignupScreen = () => {
  const { completeOnboarding } = useAuthStore();
  const [clubName, setClubName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phone, setPhoneNumber] = useState('');
  const [address, setAddress] = useState('');
  const [capacity, setCapacity] = useState('');
  const [description, setDescription] = useState('');
  const [otpModal, setOtpModal] = useState(false);
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);

  const [location_id, setCityValue] = useState('hyderabad');
  const cities = [
    { label: 'Hyderabad', value: 1 },
  ];

  const validateForm = () => {
    if (!clubName || !email || !password || !confirmPassword || !phone || !address || !capacity) {
      Alert.alert('Error', 'Please fill in all required fields.');
      return false;
    }
    
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match.');
      return false;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert('Error', 'Please enter a valid email address.');
      return false;
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?#&])[A-Za-z\d@$!%*?#&]{8,}$/;
    if (!passwordRegex.test(password)) {
      Alert.alert(
        'Error',
        'Password must be at least 8 characters, include uppercase, lowercase, number, and special character.'
      );
      return false;
    }

    const phoneRegex = /^[0-9]{10}$/;
    if (!phoneRegex.test(phone)) {
      Alert.alert('Error', 'Please enter a valid 10-digit phone number.');
      return false;
    }

    const capacityNumber = parseInt(capacity);
    if (isNaN(capacityNumber) || capacityNumber <= 0) {
      Alert.alert('Error', 'Please enter a valid capacity number.');
      return false;
    }

    return true;
  };

  const sendOtp = async () => {
    if (!validateForm()) return;
    
    setOtpLoading(true);
    try {
      await axios.post(apiEndpoints.otp, {
        email,
        purpose: "signup"
      });
      
      setOtpModal(true);
      Alert.alert('Success', 'OTP has been sent to your email address.');
    } catch (error) {
      console.error('OTP send error:', error);
      Alert.alert('Error', 'Failed to send OTP. Please try again.');
    } finally {
      setOtpLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (!otp) {
      Alert.alert('Error', 'Please enter the OTP.');
      return;
    }

    setOtpLoading(true);
    try {
      const otpResponse = await axios.post(apiEndpoints.verify, {
        email,
        otp,
        purpose: "signup"
      });

      if (!otpResponse.data.verified) {
        Alert.alert('Error', 'OTP verification failed. Please try again.');
        return;
      }
      
      // OTP verified successfully, proceed with signup
      await handleSignup();
      
    } catch (error) {
      console.error('OTP verification error:', error);
      Alert.alert('Error', 'The OTP entered is incorrect. Please re-enter.');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleSignup = async () => {
    setLoading(true);
    try {
      const signupResponse = await axios.post(apiEndpoints.signupClub, {
        club_name: clubName,
        email,
        password,
        phone,
        address,
        capacity: parseInt(capacity),
        description,
        location_id: location_id
      });

      console.log('Club signup success:', signupResponse.data);
      
      // Store the authentication data
      const { token, refreshToken, user } = signupResponse.data;
      await useAuthStore.getState().login(token, refreshToken, user, 'club');
      
      Alert.alert(
        "Signup Successful",
        "Your club account has been created successfully!",
        [
          {
            text: "Continue",
            onPress: () => {
              completeOnboarding();
              router.push('/(tabs)');
            }
          }
        ]
      );
      
    } catch (error: any) {
      console.error('Club signup error:', error);
      
      if (error.response?.status === 409) {
        Alert.alert('Error', 'Email or phone number already exists.');
      } else if (error.response?.data?.message) {
        Alert.alert('Error', error.response.data.message);
      } else {
        Alert.alert('Error', 'Failed to create club account. Please try again.');
      }
    } finally {
      setLoading(false);
      setOtpModal(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer} keyboardShouldPersistTaps="handled">
        <Image
          style={styles.logo}
          source={require('../assets/images/logo.png')}
        />

        <Modal visible={otpModal} animationType="fade" transparent>
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <TouchableOpacity style={styles.closeButton} onPress={() => setOtpModal(false)}>
                <Text style={styles.closeText}>✕</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Verify Your Email</Text>
              <Text style={styles.modalMessage}>We have sent a 6-digit OTP to {email}</Text>
              <TextInput
                style={styles.otpInput}
                onChangeText={setOtp}
                placeholder="Enter 6-digit OTP"
                value={otp}
                placeholderTextColor="#888"
                keyboardType="number-pad"
                maxLength={6}
                autoComplete="off"
              />
              <TouchableOpacity 
                style={[styles.button, otpLoading && styles.buttonDisabled]} 
                onPress={verifyOtp}
                disabled={otpLoading}
              >
                {otpLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Verify OTP</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={styles.resendButton} onPress={sendOtp}>
                <Text style={styles.resendButtonText}>Resend OTP</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <Text style={styles.title}>Create Your Club Account</Text>
        <Text style={styles.subtitle}>Join the premier platform for venues and clubs</Text>

        <KeyboardAvoidingView
          style={{ flex: 1, width: '100%' }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
        >
          <ScrollView
            contentContainerStyle={{ paddingBottom: 20 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <TextInput
              style={styles.input}
              placeholder="Club Name *"
              placeholderTextColor="#A8A29E"
              value={clubName}
              onChangeText={setClubName}
              textContentType="organizationName"
              autoComplete="off"
            />
            
            <TextInput
              style={styles.input}
              placeholder="Email Address *"
              placeholderTextColor="#A8A29E"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              textContentType="emailAddress"
              autoComplete="off"
            />
            
            <TextInput
              style={styles.input}
              placeholder="Password *"
              placeholderTextColor="#A8A29E"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              textContentType="newPassword"
              autoComplete="off"
            />
            
            <TextInput
              style={styles.input}
              placeholder="Confirm Password *"
              placeholderTextColor="#A8A29E"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              textContentType="newPassword"
              autoComplete="off"
            />
            
            <TextInput
              style={styles.input}
              placeholder="Phone Number *"
              placeholderTextColor="#A8A29E"
              value={phone}
              onChangeText={setPhoneNumber}
              keyboardType="phone-pad"
              textContentType="telephoneNumber"
              autoComplete="off"
            />

            <TextInput
              style={styles.input}
              placeholder="Address *"
              placeholderTextColor="#A8A29E"
              value={address}
              onChangeText={setAddress}
              textContentType="fullStreetAddress"
              autoComplete="off"
            />

            <TextInput
              style={styles.input}
              placeholder="Capacity *"
              placeholderTextColor="#A8A29E"
              value={capacity}
              onChangeText={setCapacity}
              keyboardType="numeric"
              textContentType="none"
              autoComplete="off"
            />

            <Dropdown
              placeholder="Select City"
              items={cities.map(item => ({ ...item, value: item.value.toString() }))}
              value={location_id}
              onSelect={setCityValue}
              zIndex={10}
            />

            <TextInput
              style={[styles.input, styles.bioInput]}
              placeholder="Tell us about your club (optional)"
              placeholderTextColor="#A8A29E"
              value={description}
              onChangeText={setDescription}
              multiline
            />
          </ScrollView>
        </KeyboardAvoidingView>

        <TouchableOpacity 
          style={[styles.button, loading && styles.buttonDisabled]} 
          onPress={sendOtp}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Create Club Account</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.loginButton} 
          onPress={() => router.push('/sign-in')}
          disabled={loading}
        >
          <Text style={styles.loginButtonText}>Already have an account? Sign In</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 40,
    paddingBottom: 40,
    paddingHorizontal: 24,
  },
  logo: {
    width: 120,
    height: 120,
    resizeMode: 'contain',
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#888888',
    marginBottom: 30,
    textAlign: 'center',
  },
  input: {
    width: '100%',
    height: 56,
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    paddingHorizontal: 20,
    fontSize: 16,
    color: '#ffffff',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#333333',
  },
  bioInput: {
    height: 120,
    textAlignVertical: 'top',
    paddingTop: 16,
  },
  button: {
    width: '100%',
    height: 56,
    backgroundColor: '#d4af37',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loginButton: {
    marginTop: 20,
    paddingVertical: 12,
  },
  loginButtonText: {
    color: '#d4af37',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  modalContent: {
    width: '85%',
    padding: 24,
    backgroundColor: '#2a2a2a',
    borderRadius: 20,
    alignItems: 'center',
    elevation: 5,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 8,
    zIndex: 1,
  },
  closeText: {
    fontSize: 24,
    color: '#888888',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 14,
    color: '#cccccc',
    marginBottom: 24,
    textAlign: 'center',
  },
  otpInput: {
    width: '100%',
    height: 56,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    paddingHorizontal: 20,
    fontSize: 20,
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#d4af37',
    letterSpacing: 10,
  },
  resendButton: {
    marginTop: 12,
    paddingVertical: 8,
  },
  resendButtonText: {
    color: '#d4af37',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
});

export default ClubSignupScreen;
