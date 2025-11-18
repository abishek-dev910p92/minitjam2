import AsyncStorage from '@react-native-async-storage/async-storage';
import { Link, router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SvgXml } from 'react-native-svg';
import apiEndpoints from '../api/baseUrl';

const ArrowLeftIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24px" height="24px" fill="currentColor" viewBox="0 0 256 256"><path d="M224,128a8,8,0,0,1-8,8H59.31l58.35,58.34a8,8,0,0,1-11.32,11.32l-72-72a8,8,0,0,1,0-11.32l72-72a8,8,0,0,1,11.32,11.32L59.31,120H216A8,8,0,0,1,224,128Z"></path></svg>`;

interface AppliedOpportunity {
  opportunity_id: number;
  title: string;
  description: string | null;
  event_date: string;
  event_time: string;
  application_status: 'pending' | 'accepted' | 'rejected';
}

const MyOpportunitiesScreen = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [opportunities, setOpportunities] = useState<AppliedOpportunity[]>([]);

  const fetchOpportunities = async (isRefreshing = false) => {
    try {
      if (!isRefreshing) setLoading(true);
      setError(null);

      const token = await AsyncStorage.getItem('userToken');
      if (!token) throw new Error('Authentication required');

      const response = await fetch(`${apiEndpoints.opportunities}/my?role=artist`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch opportunities (${response.status})`);
      }

      const data = await response.json();
      setOpportunities(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load opportunities');
    } finally {
      setLoading(false);
      if (isRefreshing) setRefreshing(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchOpportunities();
  }, []);

  // Pull to refresh handler
  const onRefresh = async () => {
    setRefreshing(true);
    await fetchOpportunities(true);
  };

  // Format application status
  const formatStatus = (status: string) => {
    switch (status.toLowerCase()) {
      case 'accepted':
        return { text: 'Accepted', color: '#16a34a' };
      case 'rejected':
        return { text: 'Rejected', color: '#dc2626' };
      case 'pending':
      default:
        return { text: 'Pending', color: '#d97706' };
    }
  };

  // Format date
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <SvgXml xml={ArrowLeftIcon} width="24" height="24" fill="#151414" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Applications</Text>
        </View>
        <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
          <ActivityIndicator size="large" color="#6b6057" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <SvgXml xml={ArrowLeftIcon} width="24" height="24" fill="#151414" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Applications</Text>
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#6b6057']}
            tintColor="#6b6057"
          />
        }
      >
        {error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : opportunities.length === 0 ? (
          <Text style={styles.noDataText}>No applications found</Text>
        ) : (
          opportunities.map((opp) => (
            <Link
              key={opp.opportunity_id}
              href={{ pathname: '/gig_details/[id]', params: { id: String(opp.opportunity_id) } }}
              asChild
            >
              <TouchableOpacity style={styles.opportunityCard}>
                <View style={styles.cardHeader}>
                  <Text style={styles.title}>{opp.title}</Text>
                  <Text 
                    style={[
                      styles.status, 
                      { color: formatStatus(opp.application_status).color }
                    ]}
                  >
                    {formatStatus(opp.application_status).text}
                  </Text>
                </View>
                {opp.description && (
                  <Text style={styles.description} numberOfLines={2}>
                    {opp.description}
                  </Text>
                )}
                <Text style={styles.date}>
                  {formatDate(opp.event_date)} • {opp.event_time}
                </Text>
              </TouchableOpacity>
            </Link>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    paddingBottom: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    zIndex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#151414',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  errorText: {
    textAlign: 'center',
    color: '#dc2626',
    fontSize: 16,
    marginTop: 20,
  },
  noDataText: {
    textAlign: 'center',
    color: '#6b7280',
    fontSize: 16,
    marginTop: 20,
  },
  opportunityCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#151414',
    flex: 1,
    marginRight: 12,
  },
  status: {
    fontSize: 14,
    fontWeight: '500',
  },
  description: {
    fontSize: 14,
    color: '#4b5563',
    marginBottom: 8,
    lineHeight: 20,
  },
  date: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
});

export default MyOpportunitiesScreen;