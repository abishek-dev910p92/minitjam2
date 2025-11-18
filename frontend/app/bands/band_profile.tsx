import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { Link, router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SvgXml } from 'react-native-svg';
import useUserData from '../_utils/Localstorage';
import apiEndpoints from '../api/baseUrl';

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
  const [bands, setBands] = useState<Band[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const { user } = useUserData();
  const [removingArtistId, setRemovingArtistId] = useState<number | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);
  const [updatingBandId, setUpdatingBandId] = useState<number | null>(null);
  const [editingBand, setEditingBand] = useState<null | Band>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editImageUri, setEditImageUri] = useState<string | null>(null);

  const openEdit = (band: Band) => {
    setEditingBand(band);
    setEditName(band.name ?? '');
    setEditDescription(band.description ?? '');
    setEditImageUri(null);
    setShowEditModal(true);
  };

  const pickEditImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission', 'Media library permission is required to choose an image');
        return;
      }
      
      setUpdatingBandId(editingBand?.band_id || null); // Show loading state
      
      const res = await ImagePicker.launchImageLibraryAsync({ 
        allowsEditing: true, 
        quality: 0.8,
        mediaTypes: ImagePicker.MediaTypeOptions.Images
      });
      
      if (res.canceled) return;
      
      // expo-image-picker v14 returns { canceled: false, assets: [...] } when selected
      const uri = (res as any).assets?.[0]?.uri ?? (res as any).uri ?? null;
      
      if (uri) {
        // Validate image size before setting
        const fileInfo = await fetch(uri).then(r => ({
          size: parseInt(r.headers.get('Content-Length') || '0'),
          type: r.headers.get('Content-Type')
        })).catch(() => ({ size: 0, type: null }));
        
        if (fileInfo.size > 5000000) { // 5MB limit
          Alert.alert('Image Too Large', 'Please select an image smaller than 5MB');
          return;
        }
        
        if (!fileInfo.type?.startsWith('image/')) {
          Alert.alert('Invalid File', 'Please select a valid image file');
          return;
        }
        
        setEditImageUri(uri);
      }
    } catch (e) {
      console.error('pickEditImage error', e);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    } finally {
      setUpdatingBandId(null); // Clear loading state
    }
  };

  const removeMember = async (bandId: number, artistId: number, memberName?: string) => {
    try {
      setRemovingArtistId(artistId);
      const token = await AsyncStorage.getItem('userToken');
      if (!token) throw new Error('Authentication required');

      const res = await fetch(`${apiEndpoints.bands}/${bandId}/members/${artistId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        let message = text || `Failed to remove member (${res.status})`;
        try { const json = JSON.parse(text || '{}'); if (json && json.error) message = json.error; } catch (e) {}
        Alert.alert('Error', message);
        return;
      }

      // update local bands list
      setBands((prev) => {
        if (!prev) return prev;
        return prev.map((b) => {
          if (Number(b.band_id) !== Number(bandId)) return b;
          return { ...b, members: b.members.filter((m) => Number(m.artist_id) !== Number(artistId)) } as Band;
        });
      });

      Alert.alert('Removed', `${memberName ?? 'Member'} has been removed from the band.`);
    } catch (err) {
      console.error('Remove member error', err);
      Alert.alert('Error', 'Failed to remove member. Please try again.');
    } finally {
      setRemovingArtistId(null);
    }
  };

  // Update a band (name, description and/or profile image)
  const updateBand = async (bandId: number, opts: { name?: string; description?: string; fileUri?: string }) => {
    try {
      setUpdatingBandId(bandId);
      const token = await AsyncStorage.getItem('userToken');
      if (!token) throw new Error('Authentication required');

      const baseUrl = apiEndpoints.bands.replace('/bands', '/');

      let res;
      if (opts.fileUri) {
        // multipart/form-data upload (do not set Content-Type header)
        const fd = new FormData();
        // derive file name and mime type
        const parts = (opts.fileUri || '').split('.');
        const ext = parts.length > 1 ? parts.pop()!.toLowerCase() : 'jpg';
        const mime = ({ jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif' } as any)[ext] || 'image/jpeg';
        const name = `band-profile.${ext}`;
        const fileObj: any = {
          uri: Platform.OS === 'android' ? opts.fileUri : opts.fileUri.replace('file://', ''),
          type: mime,
          name,
        };
        fd.append('file', fileObj);
        if (typeof opts.name === 'string') fd.append('name', opts.name);
        if (typeof opts.description === 'string') fd.append('description', opts.description);

        res = await fetch(`${apiEndpoints.bands}/${bandId}`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            // NOTE: do NOT set Content-Type for FormData in RN; fetch will set boundary for us
          } as any,
          body: fd as any,
        });
      } else {
        // JSON body for text-only updates
        const body: any = {};
        if (typeof opts.name === 'string') body.name = opts.name;
        if (typeof opts.description === 'string') body.description = opts.description;

        res = await fetch(`${apiEndpoints.bands}/${bandId}`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        });
      }

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        let message = text || `Failed to update band (${res.status})`;
        try {
          const json = JSON.parse(text || '{}');
          if (json && (json.error || json.message)) message = json.error || json.message;
        } catch (e) {
          // ignore parse errors
        }
        Alert.alert('Error', message);
        return;
      }

      const updated = await res.json().catch(() => null);
      if (!updated) {
        Alert.alert('Error', 'Failed to parse updated band response');
        return;
      }

      // Normalize profile_image_url if returned as relative path
      if (updated.profile_image_url && !updated.profile_image_url.toString().startsWith('http')) {
        updated.profile_image_url = `${apiEndpoints.bands.replace('/bands', '/')}${updated.profile_image_url}`.replace('//', '/').replace(':/', '://');
      }

      // Update local bands state
      setBands((prev) => {
        if (!prev) return prev;
        return prev.map((b) => (Number(b.band_id) === Number(bandId) ? ({ ...b, ...updated } as Band) : b));
      });

      Alert.alert('Updated', 'Band profile updated successfully');
    } catch (err) {
      console.error('Update band error', err);
      Alert.alert('Error', 'Failed to update band. Please try again.');
    } finally {
      setUpdatingBandId(null);
    }
  };

  const fetchBands = useCallback(async () => {
    try {
      setError(null);
      const token = await AsyncStorage.getItem('userToken');
      if (!token) throw new Error('Authentication required');

      const res = await fetch(apiEndpoints.bands, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error(`Failed to fetch band details (${res.status})`);

      const data = await res.json();
      if (!Array.isArray(data)) throw new Error('Invalid response shape');

      // Normalize image URLs
      const normalized: Band[] = data.map((b: any) => {
        const copy = { ...b } as Band;
        if (copy.profile_image_url && !copy.profile_image_url.toString().startsWith('http')) {
          copy.profile_image_url = `${apiEndpoints.bands.replace('/bands', '/')}${copy.profile_image_url}`.replace('//', '/').replace(':/', '://');
        }
        copy.members = Array.isArray(copy.members) ? copy.members : [];
        return copy;
      });

      setBands(normalized);
    } catch (err) {
      console.error('Fetch bands error', err);
      setError('Failed to fetch band details. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchBands();
  }, [fetchBands]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchBands();
  }, [fetchBands]);

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
      {/* Edit Band Modal */}
      <Modal
        visible={showEditModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowEditModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.editModal}>
            <Text style={styles.modalTitle}>Edit Band</Text>
            
            <Text style={styles.inputLabel}>Band Name</Text>
            <TextInput
              style={styles.input}
              value={editName}
              onChangeText={setEditName}
              placeholder="Enter band name"
              placeholderTextColor="#6b6057"
            />
            
            <Text style={styles.inputLabel}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={editDescription}
              onChangeText={setEditDescription}
              placeholder="Enter band description"
              placeholderTextColor="#6b6057"
              multiline
              numberOfLines={4}
            />
            
            <View style={styles.imagePickerSection}>
              <Text style={styles.inputLabel}>Profile Image</Text>
              <TouchableOpacity 
                style={styles.imagePickerButton} 
                onPress={pickEditImage}
              >
                <Text style={styles.buttonText}>
                  {editImageUri ? 'Change Image' : 'Select Image'}
                </Text>
              </TouchableOpacity>
              {editImageUri && (
                <Image 
                  source={{ uri: editImageUri }} 
                  style={styles.previewImage} 
                  resizeMode="cover"
                />
              )}
            </View>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]} 
                onPress={() => setShowEditModal(false)}
              >
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[
                  styles.modalButton, 
                  styles.saveButton,
                  (!editName.trim() || updatingBandId === editingBand?.band_id) ? styles.disabledButton : {}
                ]}
                onPress={() => {
                  if (!editingBand) return;
                  
                  // Validate form data
                  if (!editName.trim()) {
                    Alert.alert('Validation Error', 'Band name is required');
                    return;
                  }
                  
                  if (editName.trim().length < 2) {
                    Alert.alert('Validation Error', 'Band name must be at least 2 characters');
                    return;
                  }
                  
                  setShowEditModal(false);
                  updateBand(editingBand.band_id, {
                    name: editName.trim(),
                    description: editDescription.trim(),
                    fileUri: editImageUri ?? undefined
                  });
                }}
                disabled={!editName.trim() || updatingBandId === editingBand?.band_id}
              >
                <Text style={styles.buttonText}>
                  {updatingBandId === editingBand?.band_id ? 'Saving...' : 'Save Changes'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      
      {/* Header */}
      <View style={styles.header}>
        <Link href={`/settings`}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <SvgXml xml={ArrowLeftIcon} width="24" height="24" fill="#16120f" />
        </TouchableOpacity>
        </Link>
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
                fetchBands();
              }}
            >
              <Text style={{ color: '#fff' }}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : bands && bands.length > 0 ? (
          <>{bands.map((band) => (
            <View key={band.band_id} style={{ marginBottom: 16 }}>
              <View style={[styles.imageContainer, { paddingBottom: 8 }]}>
                {band.profile_image_url ? (
                  <Image source={{ uri: band.profile_image_url }} style={styles.profileImage} resizeMode="cover" />
                ) : (
                  <View style={[styles.profileImage, styles.placeholderImage]}>
                    <Text style={styles.placeholderText}>{band.name?.[0] ?? '?'}</Text>
                  </View>
                )}
              </View>

              <View style={styles.bandInfo}>
                <Text style={styles.bandName}>{band.name}</Text>
                {band.description && <Text style={styles.bandDescription}>{band.description}</Text>}
                <View style={{ marginTop: 10 }}>
                  <TouchableOpacity
                    accessibilityRole={'button'}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#16120f', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 }}
                    onPress={() => {
                      try {
                        setChatError(null);
                        const artistId = String(band.created_by);
                        router.push({ pathname: '/chats', params: { receiver_type: 'artist', receiver_id: artistId, receiver_name: band.name } });
                      } catch (e: any) {
                        setChatError(e?.message || 'Unable to open chat');
                      }
                    }}
                  >
                    <SvgXml xml={CreatorBadgeIcon} width="18" height="18" fill="#fbbf24" />
                    <Text style={{ color: '#fff', fontWeight: '600' }}>Chat with Creator</Text>
                  </TouchableOpacity>
                  {chatError ? (<Text style={{ color: '#dc2626', marginTop: 6 }}>{chatError}</Text>) : null}
                </View>
                
              {/* Members List */}
                <View style={{ marginTop: 12 }}>
                  <Text style={{ color: '#16120f', fontWeight: 'bold', fontSize: 16, marginBottom: 8 }}>Members</Text>
                  {/* Debugging helpers: show members length and raw JSON in dev builds */}
                  {/* {__DEV__ && (
                    <View style={{ marginBottom: 8 }}>
                      <Text style={{ color: '#9ca3af', fontSize: 12 }}>Debug — members length: {String(band.members?.length ?? 0)}</Text>
                      <ScrollView horizontal contentContainerStyle={{ paddingVertical: 6 }}>
                        <Text selectable style={{ color: '#9ca3af', fontSize: 11 }}>{JSON.stringify(band.members, null, 2)}</Text>
                      </ScrollView>
                    </View>
                  )} */}
                  {band.members && band.members.length > 0 ? (
                    band.members.map((member) => {
                      const isCreator = member.role === 'creator' || member.artist_id === band.created_by;
                      const isSelf = user && (Number(user.artist_id) === Number(member.artist_id) || Number(user.id) === Number(member.artist_id));
                      const canRemove = user && (Number(user.artist_id) === Number(band.created_by) || isSelf);
                      const showRemove = Boolean(canRemove && (!isCreator || isSelf));

                      const handleConfirm = () => {
                        Alert.alert(
                          'Remove member',
                          `Remove ${member.name} from this band?`,
                          [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Remove', style: 'destructive', onPress: () => removeMember(band.band_id, member.artist_id, member.name) }
                          ]
                        );
                      };

                      return (
                        <View
                          key={member.artist_id}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            marginTop: 4,
                            backgroundColor: '#383533',
                            padding: 8,
                            borderRadius: 8,
                            marginBottom: 4,
                            justifyContent: 'space-between'
                          }}
                        >
                          <TouchableOpacity onPress={() => router.push({ pathname: '/artist_details/[id]', params: { id: String(member.artist_id) } })} style={{ flex: 1 }}>
                            <Text style={{ color: '#fff', marginRight: 8 }}>{member.name}</Text>
                            <Text style={{ color: '#b1adaa' }}>({member.role})</Text>
                          </TouchableOpacity>
                          {isCreator && (
                            <View style={{ 
                              marginLeft: 6, 
                              backgroundColor: 'rgba(251, 191, 36, 0.1)',
                              paddingHorizontal: 8,
                              paddingVertical: 2,
                              borderRadius: 12,
                              flexDirection: 'row',
                              alignItems: 'center'
                            }}>
                              <Text style={{ color: '#fbbf24', fontSize: 12 }}>⭐ Creator</Text>
                            </View>
                          )}
                          {showRemove ? (
                            <TouchableOpacity
                              onPress={handleConfirm}
                              disabled={removingArtistId === member.artist_id}
                              style={{ marginLeft: 12, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#ef4444', borderRadius: 8 }}
                            >
                              <Text style={{ color: '#fff' }}>{removingArtistId === member.artist_id ? 'Removing...' : 'Remove'}</Text>
                            </TouchableOpacity>
                          ) : null}
                        </View>
                      );
                    })
                  ) : (
                    <Text style={{ color: '#b1adaa' }}>No members yet</Text>
                  )}
                </View>

                <View style={{ marginTop: 1, flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                  <TouchableOpacity
                    onPress={() => router.push({ pathname: '/bands/band_profile_view', params: { id: String(band.band_id) } })}
                    style={{ marginTop: 16 }}
                  >
                    <Text style={{ color: '#fff', backgroundColor: '#222', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }}>Band Page</Text>
                  </TouchableOpacity>

                  {/* Edit button visible to band creator only */}
                  {user && Number(user.artist_id) === Number(band.created_by) ? (
                    <TouchableOpacity
                      onPress={() => openEdit(band)}
                      style={{ marginLeft: 8, marginTop: 16, backgroundColor: '#16120f', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }}
                    >
                      <Text style={{ color: '#fff' }}>Edit</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            </View>
          ))}
        </>
        ) : (
          <View style={{ padding: 16 }}>
            <Text style={styles.noMembersText}>No bands created yet.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3ede6',
  },
  disabledButton: {
    opacity: 0.6,
    backgroundColor: '#999',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#1b1918',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  editModal: {
    width: '100%',
    backgroundColor: '#f3ede6',
    borderRadius: 12,
    padding: 16,
    maxWidth: 500,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#16120f',
    marginBottom: 16,
    textAlign: 'center',
  },
  inputLabel: {
    color: '#16120f',
    fontSize: 16,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#16120f',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    marginBottom: 16,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  imagePickerSection: {
    marginBottom: 16,
  },
  imagePickerButton: {
    backgroundColor: '#6b6057',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  previewImage: {
    width: '100%',
    height: 150,
    borderRadius: 8,
    marginTop: 8,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#383533',
    marginRight: 8,
  },
  saveButton: {
    backgroundColor: '#16120f',
    marginLeft: 8,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
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
 
  
  inputSimple: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#FAFAFA',
    marginTop: 8,
  },
   
  modalButtonSecondary: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  modalButtonPrimary: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#111827',
    alignItems: 'center',
  },
  modalButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
});

export default BandProfileScreen;
