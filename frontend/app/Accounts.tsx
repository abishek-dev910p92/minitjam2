import AsyncStorage from '@react-native-async-storage/async-storage';
import { Link, router } from 'expo-router';
import React, { useState } from 'react';

import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import useUserData from './_utils/Localstorage';
import apiEndpoints from './api/baseUrl';
import PendingInvitesList from './components/PendingInvitesList';
import SearchArtistModal from './components/SearchArtistModal';

 
const PlusIcon = ({ color = '#151414', size = 24 }) => (
  <Svg width={size} height={size} viewBox="0 0 256 256">
    <Path fill={color} d="M224,128a8,8,0,0,1-8,8H136v80a8,8,0,0,1-16,0V136H40a8,8,0,0,1,0-16h80V40a8,8,0,0,1,16,0v80h80A8,8,0,0,1,224,128Z" />
  </Svg>
);

const CaretLeftIcon = ({ color = '#151414', size = 18 }) => (
  <Svg width={size} height={size} viewBox="0 0 256 256">
    <Path fill={color} d="M165.66,202.34a8,8,0,0,1-11.32,11.32l-80-80a8,8,0,0,1,0-11.32l80-80a8,8,0,0,1,11.32,11.32L91.31,128Z" />
  </Svg>
);

const CaretRightIcon = ({ color = '#151414', size = 18 }) => (
  <Svg width={size} height={size} viewBox="0 0 256 256">
    <Path fill={color} d="M181.66,133.66l-80,80a8,8,0,0,1-11.32-11.32L164.69,128,90.34,53.66a8,8,0,0,1,11.32-11.32l80,80A8,8,0,0,1,181.66,133.66Z" />
  </Svg>
);

const ToggleSwitch = ({ isChecked, onToggle }: { isChecked: boolean; onToggle: () => void }) => (
  <TouchableOpacity onPress={onToggle} style={[styles.toggleTrack, isChecked ? styles.toggleTrackActive : styles.toggleTrackInactive]}>
    <View style={[styles.toggleThumb, {
      shadowColor: 'rgba(0, 0, 0, 0.15)',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.8,
      shadowRadius: 8,
      elevation: 6, // Android
    }]} />
  </TouchableOpacity>
);

export default function EditProfileScreen() {
  const [artistChecked, setArtistChecked] = useState(false);
  const [venueChecked, setVenueChecked] = useState(false);
  const [fanChecked, setFanChecked] = useState(false);
  const [loadingBands, setLoadingBands] = useState(false);
  const [deletingBandId, setDeletingBandId] = useState<number | null>(null);
  const [bands, setBands] = useState<any[] | null>(null);
  const [bandsError, setBandsError] = useState<string | null>(null);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [modalBand, setModalBand] = useState<any | null>(null);
  const [memberArtistId, setMemberArtistId] = useState('');
  const [memberRole, setMemberRole] = useState('member');
  const [modalLoading, setModalLoading] = useState(false);
  const { user } = useUserData();

  // Load bands helper
  const loadBands = async () => {
    setBands(null);
    setBandsError(null);
    setLoadingBands(true);
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) throw new Error('Authentication required');

      const res = await fetch(apiEndpoints.bands, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Failed to fetch bands (${res.status})`);
      const data = await res.json();
      setBands(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Fetch bands error', err);
      setBandsError('Failed to fetch band details. Please try again.');
    } finally {
      setLoadingBands(false);
    }
  };

  // Submit add/invite member
  const handleAddMember = async () => {
    if (!modalBand) return;
    if (!memberArtistId || memberArtistId.trim() === '') {
      Alert.alert('Validation', 'Artist ID is required');
      return;
    }

    setModalLoading(true);
    try {
      const token = await AsyncStorage.getItem('userToken');
      const userDataString = await AsyncStorage.getItem('userData');
      const userData = userDataString ? JSON.parse(userDataString) : null;
      if (!token) throw new Error('Authentication required');

      const isCreator = userData && (userData.artist_id === modalBand.created_by || userData.id === modalBand.created_by);
      const bandId = modalBand.band_id;
      const url = isCreator ? `${apiEndpoints.bands}/${bandId}/members` : `${apiEndpoints.bands}/${bandId}/invite`;
      const body = { artist_id: Number(memberArtistId), role: memberRole };

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(text || `Request failed (${res.status})`);
      }

      const json = await res.json();
      if (isCreator) {
        Alert.alert('Success', 'Member added!');
      } else {
        Alert.alert('Success', 'Invite sent!');
      }

      // Refresh bands to update members list UI
      await loadBands();
      setAddModalVisible(false);
    } catch (e: any) {
      console.error('Add member error', e);
      Alert.alert('Error', 'Failed to add member. Please try again.');
    } finally {
      setModalLoading(false);
    }
  };

  // Delete band
  const deleteBand = async (bandId: number) => {
    try {
      setDeletingBandId(bandId);
      const token = await AsyncStorage.getItem('userToken');
      if (!token) throw new Error('Authentication required');

      const res = await fetch(`${apiEndpoints.bands}/${bandId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        let message = text || `Failed to delete band (${res.status})`;
        try { const json = JSON.parse(text || '{}'); if (json && json.error) message = json.error; } catch (e) {}
        Alert.alert('Error', message);
        return;
      }

      // remove band locally
      setBands((prev) => (prev ? prev.filter((bb) => Number(bb.band_id) !== Number(bandId)) : prev));
      Alert.alert('Deleted', 'Band deleted successfully.');
    } catch (e) {
      console.error('Delete band error', e);
      Alert.alert('Error', 'Failed to delete band. Please try again.');
    } finally {
      setDeletingBandId(null);
    }
  };
// --- Icon Components ---
const ArrowLeftIcon = () => (
  <Svg height="24" width="24" viewBox="0 0 256 256">
    <Path
      fill="black"
      d="M224,128a8,8,0,0,1-8,8H59.31l58.35,58.34a8,8,0,0,1-11.32,11.32l-72-72a8,8,0,0,1,0-11.32l72-72a8,8,0,0,1,11.32,11.32L59.31,120H216A8,8,0,0,1,224,128Z"
    />
  </Svg>
);

// --- CaretDownIcon Component ---
const CaretDownIcon = ({ color = '#151414', size = 18 }) => (
  <Svg width={size} height={size} viewBox="0 0 256 256">
    <Path fill={color} d="M128,176a8,8,0,0,1-5.66-2.34l-72-72a8,8,0,0,1,11.32-11.32L128,156.69l66.34-66.35a8,8,0,0,1,11.32,11.32l-72,72A8,8,0,0,1,128,176Z" />
  </Svg>
);
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <ScrollView style={styles.scrollView}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.iconButton} onPress={() => router.back()}>
              <ArrowLeftIcon />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Edit Profile Details</Text>
          </View>

          {/* Account Type Section */}
          {/* <Text style={styles.sectionTitle}>Account Type</Text>
          <View style={styles.listItem}>
            <Text style={styles.listItemText}>Artist</Text>
            <ToggleSwitch isChecked={artistChecked} onToggle={() => setArtistChecked(!artistChecked)} />
          </View>
          <View style={styles.listItem}>
            <Text style={styles.listItemText}>Venue</Text>
            <ToggleSwitch isChecked={venueChecked} onToggle={() => setVenueChecked(!venueChecked)} />
          </View>
          <View style={styles.listItem}>
            <Text style={styles.listItemText}>Fan</Text>
            <ToggleSwitch isChecked={fanChecked} onToggle={() => setFanChecked(!fanChecked)} />
          </View> */}

          {/* Profile Actions Section */}
          <Text style={styles.sectionTitle}>Profile Actions</Text>
          <View style={styles.listItem}>
            <Text style={styles.listItemText}>Create Band Profile</Text>
            <Link href="../bands/create_band" style={styles.iconButtonSmall}>
              <PlusIcon size={24} />
            </Link>
          </View>
          <View style={styles.bandAccountSection}>
            <TouchableOpacity
              style={styles.bandAccountHeader}
              onPress={async () => {
                await loadBands();
              }}
            >
              <Text style={styles.listItemText}>View Band Account</Text>
              <View style={styles.dropdownIconContainer}>
                {loadingBands ? (
                  <View style={styles.loadingIndicator}>
                    <Text style={styles.loadingText}>Loading...</Text>
                  </View>
                ) : (
                  <CaretDownIcon color="#6b6057" size={20} />
                )}
              </View>
            </TouchableOpacity>

            {/* Bands List Container with improved styling */}
            {bands !== null && (
              <View style={styles.bandsContainer}>
                {/* Error State */}
                {bandsError && (
                  <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>{bandsError}</Text>
                    <TouchableOpacity 
                      style={styles.retryButton}
                      onPress={() => loadBands()}
                    >
                      <Text style={styles.retryButtonText}>Retry</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Empty State */}
                {!bandsError && bands.length === 0 && (
                  <View style={styles.emptyStateContainer}>
                    <Text style={styles.emptyStateText}>No band accounts found.</Text>
                    <Link href="../bands/create_band" style={styles.createBandLink}>
                      <Text style={styles.createBandText}>Create a band</Text>
                    </Link>
                  </View>
                )}

                {/* Bands List */}
                {!bandsError && bands.length > 0 && (
                  <View style={styles.bandsList}>
                    {bands.map((b) => (
                      <View key={b.band_id} style={styles.bandCard}>
                        <TouchableOpacity
                          style={styles.bandNameContainer}
                          onPress={() => {
                            const id = String(b.band_id);
                            router.push({ pathname: '/bands/band_profile', params: { id } });
                          }}
                        >
                          <Text style={styles.bandName}>{b.name}</Text>
                          {b.description ? (
                            <Text style={styles.bandDescription} numberOfLines={2}>
                              {b.description}
                            </Text>
                          ) : null}
                        </TouchableOpacity>

                        {/* Band Actions */}
                        <View style={styles.bandActions}>
                          {user && (user.artist_id === b.created_by || user.id === b.created_by) ? (
                            <TouchableOpacity
                              onPress={() => {
                                setModalBand(b);
                                setAddModalVisible(true);
                              }}
                              style={styles.addMemberButton}
                            >
                              <Text style={styles.actionButtonText}>Add Member</Text>
                            </TouchableOpacity>
                          ) : null}
                          
                          {user && (user.artist_id === b.created_by || user.id === b.created_by) ? (
                            <TouchableOpacity
                              onPress={() => {
                                Alert.alert('Delete band', `Permanently delete the band "${b.name}"? This cannot be undone.`, [
                                  { text: 'Cancel', style: 'cancel' },
                                  { text: 'Delete', style: 'destructive', onPress: () => deleteBand(b.band_id) }
                                ]);
                              }}
                              disabled={deletingBandId === b.band_id}
                              style={styles.deleteButton}
                            >
                              <Text style={styles.actionButtonText}>
                                {deletingBandId === b.band_id ? 'Deleting...' : 'Delete'}
                              </Text>
                            </TouchableOpacity>
                          ) : null}
                          
                          <TouchableOpacity
                            onPress={() => {
                              const id = String(b.band_id);
                              router.push({ pathname: '/bands/band_profile', params: { id } });
                            }}
                            style={styles.openButton}
                          >
                            <Text style={styles.openButtonText}>View</Text>
                          </TouchableOpacity>
                        </View>

                        {/* Pending invites (creator only) */}
                        {user && (user.artist_id === b.created_by || user.id === b.created_by) ? (
                          <View style={styles.pendingInvitesSection}>
                            <Text style={styles.pendingInvitesTitle}>Pending Invitations</Text>
                            <PendingInvitesList bandId={b.band_id} />
                          </View>
                        ) : null}
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}
          </View>
          {/* <View style={styles.listItem}>
            <Text style={styles.listItemText}>Add Members</Text>
            <TouchableOpacity style={styles.iconButtonSmall}>
              <PlusIcon size={24} />
            </TouchableOpacity>
          </View> */}

          {/* Media Section */}
          {/* <Text style={styles.sectionTitle}>Media</Text>
          <View style={styles.listItem}>
            <Text style={styles.listItemText}>Add Media</Text>
            <TouchableOpacity style={styles.iconButtonSmall}>
              <PlusIcon size={24} />
            </TouchableOpacity>
          </View>
          <View style={styles.spacer} /> */}
        </ScrollView>

        {/* Search + Invite Modal (creator only) */}
        <SearchArtistModal
          bandId={modalBand?.band_id}
          visible={addModalVisible}
          onClose={() => setAddModalVisible(false)}
          onInviteSuccess={() => {
            // refresh invites and bands
            loadBands();
          }}
        />

        {/* Save Button */}
        {/* <View style={styles.footer}>
          <TouchableOpacity style={styles.saveButton}>
            <Text style={styles.saveButtonText}>Save Changes</Text>
          </TouchableOpacity>
        </View> */}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f3ede6',
  },
  container: {
    flex: 1,
    backgroundColor: '#f3ede6',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 8,
    backgroundColor: '#f3ede6',
  },
  iconButton: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: -0.2,
    marginRight: 48, // To visually center the title
    color: '#151414',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: -0.2,
    color: '#151414',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  profileInfo: {
    fontSize: 14,
    letterSpacing: -0.2,
    color: '#151414',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    minHeight: 56,
  },
  listItemText: {
    fontSize: 14,
    color: '#151414',
    fontWeight: '500',
  },
  toggleTrack: {
    width: 51,
    height: 31,
    borderRadius: 15.5,
    backgroundColor: '#fff',
    padding: 2,
    justifyContent: 'center',
  },
  toggleTrackActive: {
    backgroundColor: '#fff',
    alignItems: 'flex-end',
  },
  toggleTrackInactive: {
    alignItems: 'flex-start',
  },
  toggleThumb: {
    width: 27,
    height: 27,
    borderRadius: 13.5,
    backgroundColor: '#000',
  },
  iconButtonSmall: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  
  // Band Account Section Styles
  bandAccountSection: {
    marginBottom: 16,
  },
  bandAccountHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  dropdownIconContainer: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 12,
    color: '#6b6057',
    marginRight: 4,
  },
  
  // Bands Container Styles
  bandsContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    backgroundColor: 'rgba(107, 96, 87, 0.05)',
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
  
  // Error State Styles
  errorContainer: {
    padding: 12,
    backgroundColor: 'rgba(220, 38, 38, 0.1)',
    borderRadius: 8,
    marginBottom: 8,
  },
  errorText: {
    color: '#dc2626',
    fontSize: 14,
  },
  retryButton: {
    marginTop: 8,
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#6b6057',
    borderRadius: 6,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  
  // Empty State Styles
  emptyStateContainer: {
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateText: {
    color: '#151414',
    fontSize: 14,
    marginBottom: 8,
  },
  createBandLink: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#6b6057',
    borderRadius: 8,
  },
  createBandText: {
    color: '#fff',
    fontWeight: '500',
    fontSize: 14,
  },
  
  // Bands List Styles
  bandsList: {
    marginTop: 4,
  },
  bandCard: {
    backgroundColor: '#fffbf7',
    borderRadius: 8,
    marginBottom: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  bandNameContainer: {
    marginBottom: 10,
  },
  bandName: {
    fontWeight: '600',
    fontSize: 16,
    color: '#151414',
    marginBottom: 4,
  },
  bandDescription: {
    color: '#666',
    fontSize: 14,
    lineHeight: 20,
  },
  
  // Band Actions Styles
  bandActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
    marginBottom: 8,
  },
  addMemberButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#16120f',
    borderRadius: 8,
  },
  deleteButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#ef4444',
    borderRadius: 8,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
  },
  openButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#eee',
    backgroundColor: 'rgba(107, 96, 87, 0.1)',
  },
  openButtonText: {
    color: '#151414',
    fontSize: 13,
    fontWeight: '500',
  },
  
  // Pending Invites Styles
  pendingInvitesSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  pendingInvitesTitle: {
    fontWeight: '600',
    marginBottom: 8,
    fontSize: 14,
    color: '#151414',
  },
  
  // Calendar Styles
  calendarContainer: {
    padding: 16,
    alignItems: 'center',
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: 336,
    marginBottom: 4,
  },
  calendarNavButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  calendarTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: 'bold',
    color: '#151414',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '100%',
    maxWidth: 336,
  },
  calendarDayName: {
    width: `${100 / 7}%`,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: 'bold',
    height: 48,
    lineHeight: 48,
    color: '#151414',
  },
  calendarDayButton: {
    width: `${100 / 7}%`,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  calendarDayButtonActive: {
    width: `${100 / 7}%`,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  calendarDayText: {
    fontSize: 14,
    color: '#151414',
  },
  calendarDayTextActive: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#6b6057',
    color: '#fafafa',
    textAlign: 'center',
    lineHeight: 32, // to center vertically
    fontSize: 14,
    fontWeight: '500',
    overflow: 'hidden',
  },
  spacer: {
    height: 20,
  },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f3ede6',
  },
  saveButton: {
    height: 48,
    backgroundColor: '#16120f',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fafafa',
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 0.2,
  },
});