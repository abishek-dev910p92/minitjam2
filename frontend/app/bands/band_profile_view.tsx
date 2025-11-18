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
import { LinearGradient } from 'expo-linear-gradient';
import useUserData from '../_utils/Localstorage';
import apiEndpoints from '../api/baseUrl';

const ArrowLeftIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24px" height="24px" fill="currentColor" viewBox="0 0 256 256"><path d="M224,128a8,8,0,0,1-8,8H59.31l58.35,58.34a8,8,0,0,1-11.32,11.32l-72-72a8,8,0,0,1,0-11.32l72-72a8,8,0,0,1,11.32,11.32L59.31,120H216A8,8,0,0,1,224,128Z"></path></svg>`;

const CreatorBadgeIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16px" height="16px" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path></svg>`;

// Generate random gradient colors based on band name
const getRandomGradientColors = (name: string): readonly [string, string] => {
  // Use the band name as a seed for consistent colors per band
  const seed = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  
  // Predefined gradient palettes that work well with white text
  const gradientPalettes: ReadonlyArray<readonly [string, string]> = [
    ["#4158D0", "#C850C0"],
    ["#0093E9", "#80D0C7"],
    ["#8EC5FC", "#E0C3FC"],
    ["#FF9A8B", "#FF6A88"],
    ["#FBAB7E", "#F7CE68"],
    ["#85FFBD", "#FFFB7D"],
    ["#FF3CAC", "#784BA0"],
    ["#3B2667", "#BC78EC"],
    ["#FF7EB3", "#FF758C"],
    ["#06BEB6", "#48B1BF"]
  ];
  
  // Select a palette based on the seed
  const paletteIndex = seed % gradientPalettes.length;
  return gradientPalettes[paletteIndex];
};

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
  const { user } = useUserData();
  const [removingArtistId, setRemovingArtistId] = useState<number | null>(null);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  const fetchBandDetails = useCallback(async () => {
    try {
      setError(null);
      if (!id || isNaN(Number(id))) {
        throw new Error('Invalid band id');
      }
      // The details endpoint is public. If a token exists, include it for additional fields/permissions.
      const token = await AsyncStorage.getItem('userToken');
      const headers: Record<string,string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch(`${apiEndpoints.bands}/${id}/details`, {
        headers
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
                <View style={styles.profileImage}>
                  <LinearGradient
                    colors={getRandomGradientColors(band.name)}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.gradientContainer}
                  >
                    <Text style={styles.initialText}>{band.name[0].toUpperCase()}</Text>
                  </LinearGradient>
                </View>
              )}
            </View>

            {/* Band Info */}
            <View style={styles.bandInfo}>
              <Text style={styles.bandName}>{band.name}</Text>
              {band.description && (
                <Text style={styles.bandDescription}>{band.description}</Text>
              )}
              <View style={{ marginTop: 12 }}>
                <TouchableOpacity
                  accessibilityRole={'button'}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#16120f', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 }}
                  onPress={async () => {
                    try {
                      if (!band?.created_by) return;
                      setChatError(null);
                      setChatLoading(true);
                      const artistId = String(band.created_by);
                      router.push({
                        pathname: '/chats',
                        params: {
                          receiver_type: 'artist',
                          receiver_id: artistId,
                          receiver_name: band.name,
                        }
                      });
                    } catch (e: any) {
                      setChatError(e?.message || 'Unable to start chat');
                    } finally {
                      setChatLoading(false);
                    }
                  }}
                >
                  <SvgXml xml={CreatorBadgeIcon} width="18" height="18" fill="#fbbf24" />
                  <Text style={{ color: '#fff', fontWeight: '600' }}>{chatLoading ? 'Opening…' : 'Chat with Creator'}</Text>
                </TouchableOpacity>
                {chatError ? (<Text style={{ color: '#dc2626', marginTop: 6 }}>{chatError}</Text>) : null}
              </View>
            </View>

            {/* Members List */}
            <View style={styles.membersSection}>
              <Text style={styles.sectionTitle}>Members</Text>
              {band.members && band.members.length > 0 ? (
                band.members.map((member) => {
                  const isCreator = member.artist_id === band.created_by;
                  const isSelf = user && (Number(user.artist_id) === Number(member.artist_id) || Number(user.id) === Number(member.artist_id));
                  const canRemove = user && (Number(user.artist_id) === Number(band.created_by) || isSelf);
                  // creator cannot remove another creator; only self-removal of creator allowed
                  const showRemove = Boolean(canRemove && (!isCreator || isSelf));

                  const handleConfirmRemove = () => {
                    Alert.alert(
                      'Remove member',
                      `Remove ${member.name} from this band?`,
                      [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Remove', style: 'destructive', onPress: () => removeMember(member.artist_id) }
                      ]
                    );
                  };

                  const removeMember = async (artistId: number) => {
                    try {
                      setRemovingArtistId(artistId);
                      const token = await AsyncStorage.getItem('userToken');
                      if (!token) throw new Error('Authentication required');

                      const res = await fetch(`${apiEndpoints.bands}/${band.band_id}/members/${artistId}`, {
                        method: 'DELETE',
                        headers: { Authorization: `Bearer ${token}` },
                      });

                      if (!res.ok) {
                        const text = await res.text().catch(() => '');
                        let message = text || `Failed to remove member (${res.status})`;
                        try {
                          const json = JSON.parse(text || '{}');
                          if (json && json.error) message = json.error;
                        } catch (e) {}
                        Alert.alert('Error', message);
                        return;
                      }

                      // success - update local state
                      setBand((prev) => {
                        if (!prev) return prev;
                        return { ...prev, members: prev.members.filter((m) => Number(m.artist_id) !== Number(artistId)) };
                      });
                      Alert.alert('Removed', `${member.name} has been removed from the band.`);
                    } catch (err) {
                      console.error('Remove member error', err);
                      Alert.alert('Error', 'Failed to remove member. Please try again.');
                    } finally {
                      setRemovingArtistId(null);
                    }
                  };

                  return (
                    <View key={member.artist_id} style={styles.memberItem}>
                      <View style={styles.memberInfo}>
                        <View style={styles.memberNameRow}>
                          <Text style={styles.memberName}>{member.name}</Text>
                          {isCreator && (
                            <View style={styles.creatorBadge}>
                              <SvgXml xml={CreatorBadgeIcon} width="16" height="16" fill="#fbbf24" stroke="#fbbf24" />
                              <Text style={styles.creatorText}>Creator</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.memberRole}>{member.role}</Text>
                        <Text style={styles.joinDate}>Joined {formatDate(member.joined_at)}</Text>
                      </View>
                      {showRemove ? (
                        <TouchableOpacity
                          onPress={handleConfirmRemove}
                          disabled={removingArtistId === member.artist_id}
                          style={{ marginLeft: 1, marginTop: 8, paddingHorizontal: 14, paddingVertical: 6, backgroundColor: '#ef4444', borderRadius: 8 }}
                        >
                          <Text style={{ color: '#fff' }}>{removingArtistId === member.artist_id ? 'Removing...' : 'Exit'}</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  );
                })
              ) : (
                <Text style={styles.noMembersText}>No members yet.</Text>
                
              )}
            </View>
              <View style={styles.space}>
                
              </View>

          </>
        )}
      </ScrollView>
      <View style={{ padding: 16 }}>
        {band?.created_by ? (
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#6b6057', paddingVertical: 12, borderRadius: 12 }}
            onPress={() => router.push({ pathname: '/chats', params: { receiver_type: 'artist', receiver_id: String(band?.created_by), receiver_name: band?.name ?? '' } })}
          >
            <SvgXml xml={CreatorBadgeIcon} width="18" height="18" fill="#f5f5f5" />
            <Text style={{ color: '#f5f5f5', fontWeight: '700' }}>Chat with Creator</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3ede6',
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
    backgroundColor: '#f3ede6',
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
    color: '#16120f',
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
  gradientContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
  initialText: {
    fontSize: 64,
    color: '#fff',
    fontWeight: 'bold',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  bandInfo: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  bandName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#16120f',
    marginBottom: 8,
  },
  bandDescription: {
    fontSize: 16,
    color: '#16120f',
    lineHeight: 24,
  },
  membersSection: {
    paddingHorizontal: 16,
  },
  sectionTitle: {
    color: '#16120f',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  memberItem: {
    backgroundColor: '#16120f',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  space:{
    backgroundColor: '#16120f',
    padding: 0.5,
    marginTop: 50,
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