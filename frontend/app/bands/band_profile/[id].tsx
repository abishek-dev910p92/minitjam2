import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SvgXml } from 'react-native-svg';
import apiEndpoints from '../../api/baseUrl';

const ArrowLeftIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24px" height="24px" fill="currentColor" viewBox="0 0 256 256"><path d="M224,128a8,8,0,0,1-8,8H59.31l58.35,58.34a8,8,0,0,1-11.32,11.32l-72-72a8,8,0,0,1,0-11.32l72-72a8,8,0,0,1,11.32,11.32L59.31,120H216A8,8,0,0,1,224,128Z"></path></svg>`;

const CreatorBadgeIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16px" height="16px" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path></svg>`;

interface Member {
  artist_id: number;
  name: string;
  role: string;
  joined_at: string;
}

interface Band {
  band_id: number;
  name: string;
  description: string | null;
  profile_image_url: string | null;
  created_by: number;
  created_at: string;
  updated_at: string;
  members: Member[];
}

const BandProfileScreen = () => {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [band, setBand] = useState<Band | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchBandDetails = useCallback(async () => {
    try {
      setError(null);
      if (!id || isNaN(Number(id))) {
        throw new Error('Invalid band id');
      }
      const token = await AsyncStorage.getItem('userToken');
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await fetch(`${apiEndpoints.bands}/${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch band details (${response.status})`);
      }

      const data = await response.json();
      if (data && data.profile_image_url && !data.profile_image_url.toString().startsWith('http')) {
        data.profile_image_url = `${apiEndpoints.bands.replace('/bands', '/')}${data.profile_image_url}`.replace('//', '/').replace(':/', '://');
      }
      setBand(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch band details';
      setError(message);
      if (message === 'Invalid band id') {
        Alert.alert('Invalid band', 'Band id is missing or invalid.');
      } else {
        Alert.alert('Error', 'Failed to fetch band details. Please try again.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    fetchBandDetails();
  }, [fetchBandDetails]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchBandDetails();
  }, [fetchBandDetails]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6b6057" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <SvgXml xml={ArrowLeftIcon} width="24" height="24" fill="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Band Profile</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#6b6057"
          />
        }
      >
        {error ? (
          <View style={{ padding: 16 }}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity
              style={{ marginTop: 12, alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#6b6057', borderRadius: 8 }}
              onPress={() => {
                setLoading(true);
                fetchBandDetails();
              }}
            >
              <Text style={{ color: '#fff' }}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : band && (
          <>
            {/* Profile Image */}
            <View style={styles.imageContainer}>
              {band.profile_image_url ? (
                <Image
                  source={{ uri: band.profile_image_url }}
                  style={styles.profileImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={[styles.profileImage, styles.placeholderImage]}>
                  <Text style={styles.placeholderText}>{band.name[0]}</Text>
                </View>
              )}
            </View>

            {/* Band Info */}
            <View style={styles.bandInfo}>
              <Text style={styles.bandName}>{band.name}</Text>
              {band.description && (
                <Text style={styles.bandDescription}>{band.description}</Text>
              )}
            </View>

            {/* Members List */}
            <View style={styles.membersSection}>
              <Text style={styles.sectionTitle}>Members</Text>
              {band.members.length > 1 ? (
                band.members.map((member, index) => (
                  <View key={member.artist_id} style={styles.memberItem}>
                    <View style={styles.memberInfo}>
                      <View style={styles.memberNameRow}>
                        <Text style={styles.memberName}>{member.name}</Text>
                        {member.artist_id === band.created_by && (
                          <View style={styles.creatorBadge}>
                            <SvgXml xml={CreatorBadgeIcon} width="16" height="16" fill="#fbbf24" stroke="#fbbf24" />
                            <Text style={styles.creatorText}>Creator</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.memberRole}>{member.role}</Text>
                      <Text style={styles.joinDate}>Joined {formatDate(member.joined_at)}</Text>
                    </View>
                  </View>
                ))
              ) : (
                <Text style={styles.noMembersText}>No other members yet.</Text>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1b1918',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#1b1918',
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1b1918',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 44 : 16,
    paddingBottom: 8,
  },
  backButton: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'flex-start',
    zIndex: 1,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  scrollContent: {
    paddingBottom: 20,
  },
  errorText: {
    color: '#dc2626',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 16,
    marginHorizontal: 16,
  },
  imageContainer: {
    padding: 16,
  },
  profileImage: {
    width: '100%',
    aspectRatio: 3 / 2,
    borderRadius: 12,
  },
  placeholderImage: {
    backgroundColor: '#383533',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 48,
    color: '#fff',
    fontWeight: 'bold',
  },
  bandInfo: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  bandName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
  },
  bandDescription: {
    fontSize: 16,
    color: '#b1adaa',
    lineHeight: 24,
  },
  membersSection: {
    paddingHorizontal: 16,
  },
  sectionTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  memberItem: {
    backgroundColor: '#383533',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  memberInfo: {
    flex: 1,
  },
  memberNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  memberName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
    marginRight: 8,
  },
  creatorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  creatorText: {
    color: '#fbbf24',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  memberRole: {
    fontSize: 14,
    color: '#b1adaa',
    marginBottom: 4,
  },
  joinDate: {
    fontSize: 12,
    color: '#6b6057',
  },
  noMembersText: {
    color: '#b1adaa',
    fontSize: 16,
    textAlign: 'center',
    paddingVertical: 24,
    backgroundColor: '#383533',
    borderRadius: 12,
  },
});

export default BandProfileScreen;
