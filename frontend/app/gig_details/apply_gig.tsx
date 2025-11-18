import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SvgXml } from 'react-native-svg';
import useAuthStore from '../_utils/authStore';
import useUserData from '../_utils/Localstorage';
import apiEndpoints from '../api/baseUrl';

const ArrowLeftIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24px" height="24px" fill="currentColor" viewBox="0 0 256 256"><path d="M224,128a8,8,0,0,1-8,8H59.31l58.35,58.34a8,8,0,0,1-11.32,11.32l-72-72a8,8,0,0,1,0-11.32l72-72a8,8,0,0,1,11.32,11.32L59.31,120H216A8,8,0,0,1,224,128Z"></path></svg>`;

interface OpportunityDetails {
  opportunity_id: number;
  title: string;
  event_date: string;
  event_time: string;
  status: string;
  venue?: {
    name: string;
  };
}

interface ApplicationForm {
  message: string;
}

const ApplyGigScreen = () => {
  const params = useLocalSearchParams();
  const { id } = params;
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [opportunity, setOpportunity] = useState<OpportunityDetails | null>(null);
  const [form, setForm] = useState<ApplicationForm>({
    message: '',
  });
  
  const { isLoggedIn } = useAuthStore();
  const { user, loading: userLoading } = useUserData();

  useEffect(() => {
    if (!id) {
      setError('Missing opportunity ID');
      setLoading(false);
      return;
    }

    const fetchOpportunity = async () => {
      try {
        setLoading(true);
        setError(null);

        const token = await AsyncStorage.getItem('userToken');
        if (!token) throw new Error('Authentication required');

        const response = await fetch(`${apiEndpoints.opportunities}/${id}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch opportunity (${response.status})`);
        }

        const data = await response.json();
        setOpportunity(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load opportunity');
      } finally {
        setLoading(false);
      }
    };

    fetchOpportunity();
  }, [id]);

  const handleSubmit = async () => {
    if (!id || !opportunity) return;
    if (!user?.artist_id) {
      setError('Artist profile not found');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const token = await AsyncStorage.getItem('userToken');
      if (!token) throw new Error('Authentication required');

      const response = await fetch(`${apiEndpoints.opportunities}/${id}/apply`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: form.message.trim(),
          artist_id: user.artist_id
        }),
      });

      if (!response.ok) {
        // Handle already applied case (400/409)
        if (response.status === 400 || response.status === 409) {
          Alert.alert('Already Applied', "You've already applied to this gig.");
          router.replace('/gig_details/myopportunities');
          return;
        }

        const text = await response.text().catch(() => null);
        throw new Error(text || `Failed to submit application (${response.status})`);
      }

      // Show success message
      Alert.alert('Success', 'Application submitted successfully');

      // Navigate to my opportunities list
      router.replace('/gig_details/myopportunities');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit application');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <SvgXml xml={ArrowLeftIcon} width="24" height="24" fill="#151414" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Loading...</Text>
        </View>
        <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
          <ActivityIndicator size="large" color="#6b6057" />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !opportunity) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <SvgXml xml={ArrowLeftIcon} width="24" height="24" fill="#151414" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Error</Text>
        </View>
        <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: 16 }]}>
          <Text style={styles.errorText}>{error || 'Failed to load opportunity'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!isLoggedIn) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <SvgXml xml={ArrowLeftIcon} width="24" height="24" fill="#151414" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Login Required</Text>
        </View>
        <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: 16 }]}>
          <Text style={styles.normalText}>Please log in to apply for this opportunity.</Text>
          <TouchableOpacity 
            style={[styles.button, { marginTop: 16 }]} 
            onPress={() => router.push('/sign-in')}
          >
            <Text style={styles.buttonText}>Go to Login</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <SvgXml xml={ArrowLeftIcon} width="24" height="24" fill="#151414" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Apply for Gig</Text>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Opportunity Summary */}
          <Text style={styles.gigTitle}>{opportunity.title}</Text>
          {opportunity.venue && (
            <Text style={styles.venueText}>at {opportunity.venue.name}</Text>
          )}
          <Text style={styles.dateText}>{new Date(opportunity.event_date).toLocaleDateString()} • {opportunity.event_time}</Text>

          {/* Form */}
          <View style={styles.formContainer}>
            <Text style={styles.label}>Your Message</Text>
            <TextInput
              style={styles.messageInput}
              placeholder="Write a message to the venue..."
              multiline
              numberOfLines={4}
              value={form.message}
              onChangeText={(text) => setForm(prev => ({ ...prev, message: text }))}
            />
          </View>
          
          {error && (
            <Text style={[styles.errorText, { marginTop: 16 }]}>{error}</Text>
          )}
        </ScrollView>

        {/* Submit Button */}
        <View style={styles.submitButtonWrapper}>
          <TouchableOpacity 
            style={[styles.button, submitting && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={submitting || !form.message.trim()}
          >
            <Text style={styles.buttonText}>
              {submitting ? 'Submitting...' : 'Submit Application'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#ebebeb',
  },
  backButton: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 0,
    zIndex: 1,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: '#151414',
    fontSize: 18,
    fontWeight: 'bold',
    lineHeight: 24,
    marginLeft: -48,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  gigTitle: {
    color: '#151414',
    fontSize: 22,
    fontWeight: 'bold',
    lineHeight: 28,
    paddingHorizontal: 16,
    paddingBottom: 4,
    paddingTop: 20,
  },
  venueText: {
    color: '#77726e',
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 24,
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  dateText: {
    color: '#77726e',
    fontSize: 14,
    fontWeight: 'normal',
    lineHeight: 20,
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  formContainer: {
    paddingHorizontal: 16,
  },
  label: {
    color: '#151414',
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
    marginTop: 16,
  },
  messageInput: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    minHeight: 120,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#dddbda',
  },

  submitButtonWrapper: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f5f5f5',
  },
  button: {
    height: 48,
    borderRadius: 12,
    backgroundColor: '#161513ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#f5f5f5',
    fontSize: 16,
    fontWeight: 'bold',
  },
  normalText: {
    color: '#151414',
    fontSize: 16,
    textAlign: 'center',
  },
  errorText: {
    color: '#dc2626',
    fontSize: 16,
    textAlign: 'center',
  },
});

export default ApplyGigScreen;