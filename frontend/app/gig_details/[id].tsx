 
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Link, router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SvgXml } from 'react-native-svg';
import useAuthStore from '../_utils/authStore';
import apiEndpoints from '../api/baseUrl';

const ArrowLeftIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24px" height="24px" fill="currentColor" viewBox="0 0 256 256"><path d="M224,128a8,8,0,0,1-8,8H59.31l58.35,58.34a8,8,0,0,1-11.32,11.32l-72-72a8,8,0,0,1,0-11.32l72-72a8,8,0,0,1,11.32,11.32L59.31,120H216A8,8,0,0,1,224,128Z"></path></svg>`;

interface OpportunityDetails {
  opportunity_id: number;
  club_id: number;
  title: string;
  description: string | null;
  event_date: string;
  event_time: string;
  status: string;
  created_at: string;
  venue?: {
    name: string;
    location_id: number;
    profile_image_url: string | null;
  };
}

const GigOpportunityScreen = () => {
  const params = useLocalSearchParams();
  const { id } = params;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [opportunity, setOpportunity] = useState<OpportunityDetails | null>(null);
  const { isLoggedIn } = useAuthStore();

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

  return (
    <SafeAreaView style={styles.container}>
      {/* Header with Back Button */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <SvgXml xml={ArrowLeftIcon} width="24" height="24" fill="#151414" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Gig Details</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Title and Description */}
        <Text style={styles.gigTitle}>{opportunity.title}</Text>
        <Text style={styles.gigDescription}>
          {opportunity.description || 'No description available'}
        </Text>

        {/* Details Section */}
        <Text style={styles.sectionTitle}>Details</Text>
        <View style={styles.detailsContainer}>
          {/* Event Date */}
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Event Date</Text>
            <Text style={styles.detailValue}>{new Date(opportunity.event_date).toLocaleDateString()}</Text>
          </View>
          {/* Event Time */}
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Event Time</Text>
            <Text style={styles.detailValue}>{opportunity.event_time}</Text>
          </View>
          {/* Status */}
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Status</Text>
            <Text style={styles.detailValue}>{opportunity.status}</Text>
          </View>
        </View>

        {/* Venue Section */}
        {opportunity.venue && (
          <>
            <Text style={styles.sectionTitle}>Venue</Text>
            <View style={styles.venueContainer}>
              <Image
                source={{ uri: opportunity.venue.profile_image_url || "https://placeholder.pics/svg/300" }}
                style={styles.venueImage}
              />
              <View style={styles.venueTextContainer}>
                <Text style={styles.venueName} numberOfLines={1}>{opportunity.venue.name}</Text>
                <Text style={styles.venueAddress} numberOfLines={2}>Location ID: {opportunity.venue.location_id}</Text>
              </View>
            </View>
          </>
        )}
      </ScrollView>

      {/* Apply Now Button (Footer removed, but button kept) */}
      {isLoggedIn && opportunity.status === 'open' && (
        <View style={styles.applyButtonWrapper}>
          <Link href={{ pathname: '/gig_details/apply_gig', params: { id: String(opportunity.opportunity_id) } }} asChild>
            <TouchableOpacity style={styles.applyButton}>
              <Text style={styles.applyButtonText}>Apply Now</Text>
            </TouchableOpacity>
          </Link>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5', // Neutral-50 equivalent
  },
  
  // --- Header Styles ---
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#ebebeb', // Light separator
  },
  backButton: {
    width: 48, // Size-12 * 4 (approximation)
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 0,
    zIndex: 1, // Ensure the button is tappable
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: '#151414',
    fontSize: 18, // lg
    fontWeight: 'bold',
    lineHeight: 24,
    // Compensate for the back button's space to center the text better
    marginLeft: -48,
  },
  
  // --- Scroll Content Styles ---
  scrollContent: {
    paddingBottom: 20, // Add some bottom padding for the scroll view
  },

  // --- Title and Description Styles ---
  gigTitle: {
    color: '#151414',
    fontSize: 22,
    fontWeight: 'bold',
    lineHeight: 28, // Approximation for tight leading
    paddingHorizontal: 16, // px-4
    paddingBottom: 12, // pb-3
    paddingTop: 20, // pt-5
  },
  gigDescription: {
    color: '#151414',
    fontSize: 16, // base
    fontWeight: 'normal',
    lineHeight: 24, // normal leading
    paddingHorizontal: 16, // px-4
    paddingBottom: 12, // pb-3
    paddingTop: 4, // pt-1
  },

  // --- Section Title Style ---
  sectionTitle: {
    color: '#151414',
    fontSize: 18, // lg
    fontWeight: 'bold',
    lineHeight: 24, // tight leading
    paddingHorizontal: 16, // px-4
    paddingBottom: 8, // pb-2
    paddingTop: 16, // pt-4
  },

  // --- Details Container Styles ---
  detailsContainer: {
    paddingHorizontal: 16, // p-4, but splitting for cleaner layout
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#dddbda',
    paddingVertical: 16, // py-5
    alignItems: 'center',
  },
  detailLabel: {
    color: '#77726e',
    fontSize: 14, // sm
    fontWeight: 'normal',
    flex: 1, // Take up one column space
  },
  detailValue: {
    color: '#151414',
    fontSize: 14, // sm
    fontWeight: 'normal',
    textAlign: 'right',
    flex: 2, // Take up the remaining space
  },

  // --- Venue Styles ---
  venueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 16, // px-4
    minHeight: 72,
    paddingVertical: 8, // py-2
  },
  venueImage: {
    width: 56, // size-14
    height: 56,
    borderRadius: 8, // rounded-lg
    marginRight: 16, // gap-4
    backgroundColor: '#ccc', // Placeholder background
  },
  venueTextContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  venueName: {
    color: '#151414',
    fontSize: 16, // base
    fontWeight: '500', // medium
    lineHeight: 24, // normal
  },
  venueAddress: {
    color: '#77726e',
    fontSize: 14, // sm
    fontWeight: 'normal',
    lineHeight: 20, // normal
  },

  // --- Apply Button Styles ---
  applyButtonWrapper: {
    paddingHorizontal: 16, // px-4
    paddingVertical: 12, // py-3
    backgroundColor: '#f5f5f5',
    // Removed the second 'h-5' View as it was part of the original footer spacing
  },
  applyButton: {
    height: 48, // h-12
    borderRadius: 12, // rounded-xl
    backgroundColor: '#161513ff',
    alignItems: 'center',
    justifyContent: 'center',
    // flex-1 is implicit with no fixed width
  },
  applyButtonText: {
    color: '#f5f5f5', // neutral-50
    fontSize: 16, // base
    fontWeight: 'bold',
    // tracking-[0.015em] is subtle, often omitted or handled by a specific font in RN
  },
  errorText: {
    color: '#dc2626',
    fontSize: 16,
    textAlign: 'center'
  },
});

export default GigOpportunityScreen;