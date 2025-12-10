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
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import useAuthStore from '../_utils/authStore';
import { router } from 'expo-router';
import apiEndpoints from '../api/baseUrl';
import Dropdown from './Dropdown';

const FinalOnboardingScreen = () => {
  const { completeOnboarding } = useAuthStore();
  const [name, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phone, setPhoneNumber] = useState('');
  const [bio, setBio] = useState('');
  const [otpModal, setOtpModal] = useState(false);
  const [otp, setOtp] = useState('');

  const [genreValue, setGenreValue] = useState(null);
  const genre_id = [
    { label: 'Musician', value: 1 },
    { label: 'Stand up comedian', value: 2 },
    { label: 'Dancer', value: 3 },
    { label: 'Other...', value: 4 },
  ];

  const [location_id, setCityValue] = useState('hyderabad');
  const cities = [
    { label: 'Hyderabad', value: 1 },
  ];

  const verfyOtp = () => {
    if (!name || !email || !password || !phone || !genreValue || !location_id) {
      Alert.alert('Error', 'Please fill in all fields.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert('Error', 'Please enter a valid email address.');
      return;
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?#&])[A-Za-z\d@$!%*?#&]{8,}$/;
    if (!passwordRegex.test(password)) {
      Alert.alert(
        'Error',
        'Password must be at least 8 characters, include uppercase, lowercase, number, and special character.'
      );
      return;
    }

    const phoneRegex = /^[0-9]{10}$/;
    if (!phoneRegex.test(phone)) {
      Alert.alert('Error', 'Please enter a valid 10-digit phone number.');
      return;
    }
    setOtpModal(true);
    axios.post(apiEndpoints.otp, {
      email,
      "purpose": "signup"
    });
  }

  const handleSignUp = async () => {
    if (!otp) {
      Alert.alert('OTP', 'Please enter OTP.');
      return;
    }

    try {
      const otpResponse = await axios.post(apiEndpoints.verify, {
        email,
        otp,
        purpose: "signup"
      });

      if (!otpResponse.data.verified) {
        Alert.alert('OTP', 'OTP verification failed.');
        return;
      }
      setOtpModal(false);
    } catch (err) {
      console.log('OTP verification error:', err);
      Alert.alert('OTP', 'The OTP entered is incorrect. Please re-enter.');
      return;
    }

    try {
      const signupResponse = await axios.post(apiEndpoints.signup, {
        name,
        email,
        password,
        phone,
        bio,
        genre_id: genreValue,
        location_id: location_id
      });
      console.log('Signup success:', signupResponse.data);
      Alert.alert(
        "Signup Successful",
        "You have successfully created your account. Please continue to login.",
        [
          {
            text: "Continue",
            onPress: () => {
              completeOnboarding();
            }
          }
        ]
      );
    } catch (err) {
      console.log('Signup error:', err);
      Alert.alert('Signup Failed', 'Email or phone number already exists.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer} keyboardShouldPersistTaps="handled">
        <Image
          style={styles.logo}
          source={require('../../assets/images/logo.png')}
        />

        <Modal visible={otpModal} animationType="fade" >
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <TouchableOpacity style={styles.closeButton} onPress={() => setOtpModal(false)}>
                <Text style={styles.closeText}>✕</Text>
              </TouchableOpacity>
              <Text style={styles.title}>OTP Verification</Text>
              <Text style={styles.subtext}>We have sent a 6 digit OTP to your email {email}</Text>
              <TextInput
                style={styles.input}
                onChangeText={setOtp}
                placeholder="Enter 6 digt otp.."
                value={otp}
                placeholderTextColor="#888"
                keyboardType="number-pad"
                autoComplete="off"
              />
              <TouchableOpacity style={styles.button} onPress={handleSignUp}>
                <Text style={styles.buttonText}>Verify OTP</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.Resendbutton} onPress={verfyOtp}>
                <Text style={styles.ResendbuttonText}>Resend OTP</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <Text style={styles.title}>Create your account</Text>
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
              placeholder="Full Name"
              placeholderTextColor="#A8A29E"
              value={name}
              onChangeText={setFullName}
              textContentType="name"
              autoComplete="off"
            />
            <TextInput
              style={styles.input}
              placeholder="Email"
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
              placeholder="Password"
              placeholderTextColor="#A8A29E"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              textContentType="newPassword"
              autoComplete="off"
            />
            <TextInput
              style={styles.input}
              placeholder="Confirm Password"
              placeholderTextColor="#A8A29E"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              textContentType="newPassword"
              autoComplete="off"
            />
            <TextInput
              style={styles.input}
              placeholder="+91 Phone Number"
              placeholderTextColor="#A8A29E"
              value={phone}
              onChangeText={setPhoneNumber}
              keyboardType="phone-pad"
              autoComplete="off"
            />

            <Dropdown
            placeholder="Artist Type"
            items={genre_id.map(item => ({ ...item, value: item.value.toString() }))}
            value={genreValue || ''}
            onSelect={(value: string) => setGenreValue(value as unknown as null)}
            zIndex={20} // Higher z-index to be on top
            />

            <Dropdown
              placeholder="Select a City"
              items={cities.map(item => ({ ...item, value: item.value.toString() }))}
              value={location_id}
              onSelect={setCityValue}
              zIndex={10}
            />

            <TextInput
              style={[styles.input, styles.bioInput]}
              placeholder="Tell us about yourself (optional)"
              placeholderTextColor="#A8A29E"
              value={bio}
              onChangeText={setBio}
              multiline
            />
          </ScrollView>
        </KeyboardAvoidingView>
        <TouchableOpacity style={styles.button} onPress={verfyOtp}>
          <Text style={styles.buttonText}>Sign Up & Complete</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => { try { completeOnboarding(); router.push('/sign-in'); } catch {} }}>
          <Text style={styles.loginText}>Already have an account? Log In</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3ede6',
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 60,
    paddingBottom: 40,
    paddingHorizontal: 24,
  },
  logo: {
    width: 120,
    height: 120,
    resizeMode: 'contain',
    marginBottom: 30,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    width: '85%',
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 15,
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  closeButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    padding: 5,
    zIndex: 1,
  },
  closeText: {
    fontSize: 20,
    color: '#333',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#16120f',
    marginBottom: 30,
  },
  subtext: {
    fontSize: 14,
    color: '#78716C',
    marginBottom: 20,
  },
  input: {
    width: '100%',
    height: 56,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 20,
    fontSize: 16,
    color: '#16120f',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E7E5E4',
  },
  bioInput: {
    height: 120,
    textAlignVertical: 'top',
    paddingTop: 16,
  },
  button: {
    width: '100%',
    height: 56,
    backgroundColor: '#16120f',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  Resendbutton: {
    width: '100%',
    height: 56,
    backgroundColor: '#fff',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  ResendbuttonText: {
    color: '#16120f',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loginText: {
    color: '#78716C',
    textDecorationLine: 'underline',
    marginTop: 24,
    fontSize: 14,
  },
});

export default FinalOnboardingScreen;
