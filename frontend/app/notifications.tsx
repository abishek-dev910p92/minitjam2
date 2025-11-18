import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SvgXml } from 'react-native-svg';
import usePullToRefresh from './_utils/usePullToRefresh';
import useChat from './utils/useChat';
import apiEndpoints from './api/baseUrl';
const ArrowLeftIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 256 256"><path d="M224,128a8,8,0,0,1-8,8H59.31l58.35,58.34a8,8,0,0,1-11.32,11.32l-72-72a8,8,0,0,1,0-11.32l72-72a8,8,0,0,1,11.32,11.32L59.31,120H216A8,8,0,0,1,224,128Z"></path></svg>`;
const BellIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 256 256"><path d="M221.8,175.94C216.25,166.38,208,139.33,208,104a80,80,0,1,0-160,0c0,35.34-8.26,62.38-13.81,71.94A16,16,0,0,0,48,200H88.81a40,40,0,0,0,78.38,0H208a16,16,0,0,0,13.8-24.06ZM128,216a24,24,0,0,1-22.62-16h45.24A24,24,0,0,1,128,216ZM48,184c7.7-13.24,16-43.92,16-80a64,64,0,1,1,128,0c0,36.05,8.28,66.73,16,80Z"></path></svg>`;
const CaretRightIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 256 256"><path d="M181.66,133.66l-80,80a8,8,0,0,1-11.32-11.32L164.69,128,90.34,53.66a8,8,0,0,1,11.32-11.32l80,80A8,8,0,0,1,181.66,133.66Z"></path></svg>`;
const GroupIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 256 256"><path d="M128,80a32,32,0,1,0,32,32A32,32,0,0,0,128,80Zm0,48a16,16,0,1,1,16-16A16,16,0,0,1,128,128Zm80-32a24,24,0,1,0,24,24A24,24,0,0,0,208,96Zm0,32a8,8,0,1,1,8-8A8,8,0,0,1,208,128Zm-56-32a24,24,0,1,0,24,24A24,24,0,0,0,152,96Zm0,32a8,8,0,1,1,8-8A8,8,0,0,1,152,128ZM56,96a24,24,0,1,0,24,24A24,24,0,0,0,56,96Zm0,32a8,8,0,1,1,8-8A8,8,0,0,1,56,128Zm72,88a48,48,0,1,0-48,48A48,48,0,0,0,128,216Zm0-64a16,16,0,1,1-16,16A16,16,0,0,1,128,152Zm80-32a32,32,0,1,0-32,32A32,32,0,0,0,208,120Zm0,32a8,8,0,1,1,8-8A8,8,0,0,1,208,152Zm-56-32a32,32,0,1,0-32,32A32,32,0,0,0,152,120Zm0,32a8,8,0,1,1,8-8A8,8,0,0,1,152,152Z"></path></svg>`;

interface BandInvitation {
  invite_id: number;
  band_id: number;
  invited_artist_id: number;
  invited_by: number;
  band_name: string;
  role: string;
  status: 'pending' | 'accepted' | 'rejected';
  invited_at: string;
}

type DMNotification = {
  notification_id: number;
  owner_type: string;
  owner_id: number;
  message: string;
  payload?: {
    kind: string;
    sender_type: string;
    sender_id: number;
    receiver_type: string;
    receiver_id: number;
    chat_id?: number;
    preview?: string;
    sent_at?: string;
  };
  created_at?: string;
  dismissed_at?: string | null;
};

const notifications = [
  { message: "Your booking for The Roxy has been confirmed", time: "1d" },
  { message: "New venue added: The Echo", time: "2d" },
  { message: "Your booking for The Troubadour is pending", time: "3d" },
  { message: "New venue added: The Hotel Cafe", time: "4d" },
  { message: "Your booking for The Viper Room has been confirmed", time: "5d" },
];

const NotificationItem = ({ message, time }: { message: string; time: string }) => (
  <TouchableOpacity style={styles.notificationItem}>
    <View style={styles.iconContainer}>
      <SvgXml xml={BellIcon} width="24" height="24" />
    </View>
    <View style={styles.notificationTextContainer}>
      <Text style={styles.notificationMessage} numberOfLines={1}>{message}</Text>
      <Text style={styles.notificationTime} numberOfLines={2}>{time}</Text>
    </View>
    <View style={styles.caretIconContainer}>
      <SvgXml xml={CaretRightIcon} width="24" height="24" />
    </View>
  </TouchableOpacity>
);

const DMNotificationItem = ({ item, onOpen, onDismiss }: {
  item: DMNotification;
  onOpen: () => void;
  onDismiss: () => void;
}) => {
  const preview = item.payload?.preview || item.message || 'New message';
  const time = item.payload?.sent_at ? new Date(item.payload.sent_at).toLocaleString() : (item.created_at ? new Date(item.created_at).toLocaleString() : '');
  return (
    <View style={styles.notificationItem}>
      <View style={styles.iconContainer}>
        <SvgXml xml={BellIcon} width="24" height="24" />
      </View>
      <TouchableOpacity style={[styles.notificationTextContainer, { flex: 1 }]} onPress={onOpen}>
        <Text style={styles.notificationMessage} numberOfLines={1}>{preview}</Text>
        <Text style={styles.notificationTime} numberOfLines={2}>{time}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.caretIconContainer} onPress={onDismiss}>
        <Text style={{ color: '#ef4444', fontFamily: 'Manrope-600' }}>Dismiss</Text>
      </TouchableOpacity>
    </View>
  );
};

const BandInvitationItem = ({ invitation, onStatusUpdate }: { invitation: BandInvitation; onStatusUpdate: () => void }) => {
  const [loading, setLoading] = useState(false);
  const [actionStatus, setActionStatus] = useState<'idle' | 'accepting' | 'rejecting' | 'accepted' | 'rejected'>('idle');

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    return date.toLocaleDateString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#f59e0b';
      case 'accepted': return '#10b981';
      case 'rejected': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const handleResponse = async (action: 'accept' | 'reject') => {
    if (loading || invitation.status !== 'pending') return;

    // Prevent duplicate submissions
    if (actionStatus === 'accepting' || actionStatus === 'rejecting') {
      console.log('Action already in progress, ignoring duplicate request');
      return;
    }

    setLoading(true);
    setActionStatus(action === 'accept' ? 'accepting' : 'rejecting');

    let token = '';
    let authCode = '';

    try {
      const tokenRaw = await AsyncStorage.getItem('userToken');
      token = tokenRaw ?? '';
      if (!token) {
        Alert.alert('Error', 'Please log in to respond to this invitation');
        return;
      }

      // Get additional auth data if available
      const userDataString = await AsyncStorage.getItem('userData');
      let userData = null;
      if (userDataString) {
        try {
          userData = JSON.parse(userDataString);
          // Check if authcode exists in user data
          authCode = userData.authcode || userData.auth_code || userData.code || '';
          console.log('Auth data available:', { 
            hasAuthCode: !!authCode, 
            authCodeLength: authCode.length,
            userDataKeys: Object.keys(userData),
            fullUserData: userData // Log the full user data to see what's available
          });
        } catch (e) {
          console.log('Could not parse user data for authcode');
        }
      }

      const response = await fetch(
        `${apiEndpoints.bands}/${invitation.band_id}/invite/${invitation.invite_id}/respond`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            // Try adding authcode as a header as well
            ...(authCode ? { 'X-Auth-Code': authCode } : {}),
          },
          body: JSON.stringify({
            status: action === 'accept' ? 'accepted' : 'rejected',
            // Try different parameter names that might be expected
            authcode: authCode,
            auth_code: authCode,
            code: authCode,
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'No response body');
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        
        try {
          const errorData = JSON.parse(errorText);
          if (errorData.error) {
            errorMessage = `${errorMessage} - ${errorData.error}`;
          } else if (errorData.message) {
            errorMessage = `${errorMessage} - ${errorData.message}`;
          }
        } catch (e) {
          // If not JSON, use the raw text
          if (errorText && errorText !== 'No response body') {
            errorMessage = `${errorMessage} - ${errorText}`;
          }
        }
        
        // Log the full error response for debugging
        console.log(`API Error Response for ${action}:`, {
          status: response.status,
          statusText: response.statusText,
          errorText: errorText,
          requestData: { status: action, authcode: authCode, auth_code: authCode, code: authCode },
          headers: {
            'Authorization': `Bearer ${token}`,
            ...(authCode ? { 'X-Auth-Code': authCode } : {}),
          }
        });
        
        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log(`Successfully ${action}ed invitation:`, result);
      console.log(`Request details for successful ${action}:`, {
        url: `${apiEndpoints.bands}/${invitation.band_id}/invite/${invitation.invite_id}/respond`,
        headers: {
          'Authorization': `Bearer ${token}`,
          ...(authCode ? { 'X-Auth-Code': authCode } : {}),
        },
        body: { status: action === 'accept' ? 'accepted' : 'rejected', authcode: authCode, auth_code: authCode, code: authCode }
      });
      
      // Update local state
      setActionStatus(action === 'accept' ? 'accepted' : 'rejected');
      
      // Show success feedback
      Alert.alert(
        'Success',
        action === 'accept' 
          ? `You have joined ${invitation.band_name} as ${invitation.role}`
          : `You have declined the invitation to join ${invitation.band_name}`
      );

      // Refresh the invitations list after a delay to allow server to process
      setTimeout(() => {
        onStatusUpdate();
      }, 1000);

    } catch (error) {
      console.error(`Error ${action}ing invitation:`, error);
      let errorMessage = `Failed to ${action} invitation. Please try again.`;
      
      // Provide more specific error messages based on the error
      if (error instanceof Error) {
        if (error.message.includes('401')) {
          errorMessage = 'Authentication failed. Please log in again.';
        } else if (error.message.includes('403')) {
          errorMessage = 'You do not have permission to perform this action.';
        } else if (error.message.includes('404')) {
          errorMessage = 'Invitation not found. It may have been withdrawn.';
        } else if (error.message.includes('Duplicate entry')) {
          errorMessage = 'This invitation has already been processed. Please refresh the page.';
        } else if (error.message.includes('Server error')) {
          errorMessage = `Server error occurred. Please try again later.`;
        }
      }
      
      // Log the full error details for debugging
      console.log(`Full ${action} error details:`, {
        error: error,
        requestData: { status: action, authcode: authCode },
        hasToken: !!token,
        hasAuthCode: !!authCode,
        authCodeLength: authCode.length
      });
      
      Alert.alert('Error', errorMessage);
      setActionStatus('idle');
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = () => handleResponse('accept');
  const handleReject = () => handleResponse('reject');

  // Show action buttons only for pending invitations
  const showActions = invitation.status === 'pending' && actionStatus !== 'accepted' && actionStatus !== 'rejected';

  return (
    <View style={styles.invitationItem}>
      <View style={styles.invitationContent}>
        <View style={styles.iconContainer}>
          <SvgXml xml={BellIcon} width="24" height="24" />
        </View>
        <View style={styles.invitationTextContainer}>
          <Text style={styles.invitationTitle} numberOfLines={1}>
            Band invitation: {invitation.band_name}
          </Text>
          <Text style={styles.invitationDetails}>
            Role: {invitation.role} • Status: 
            <Text style={[styles.invitationStatus, { color: getStatusColor(
              actionStatus === 'accepted' ? 'accepted' : 
              actionStatus === 'rejected' ? 'rejected' : 
              invitation.status
            ) }]}>
              {actionStatus === 'accepted' ? 'accepted' : 
               actionStatus === 'rejected' ? 'rejected' : 
               invitation.status}
            </Text>
          </Text>
          <Text style={styles.invitationTime}>
            Invited by user {invitation.invited_by} • {formatDate(invitation.invited_at)}
          </Text>
        </View>
      </View>
      
      {showActions && (
        <View style={styles.actionButtonsContainer}>
          <TouchableOpacity 
            style={[styles.actionButton, styles.rejectButton]} 
            onPress={handleReject}
            disabled={loading}
          >
            {actionStatus === 'rejecting' ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={[styles.actionButtonText, styles.rejectButtonText]}>Reject</Text>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionButton, styles.acceptButton]} 
            onPress={handleAccept}
            disabled={loading}
          >
            {actionStatus === 'accepting' ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={[styles.actionButtonText, styles.acceptButtonText]}>Accept</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const Notification = () => {
  const router = useRouter();
  const chatSocket = useChat();
  const [bandInvitations, setBandInvitations] = useState<BandInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { refreshControl, runRefresh } = usePullToRefresh();

  // DM notifications state
  const [dmNotifs, setDmNotifs] = useState<DMNotification[]>([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifError, setNotifError] = useState<string | null>(null);
  const [hasMoreDm, setHasMoreDm] = useState(true);
  const dmPageRef = useRef(1);
  const dmPerPageRef = useRef(20);

  const fetchDmNotifications = async (reset = false) => {
    try {
      setNotifLoading(true);
      setNotifError(null);
      const token = await AsyncStorage.getItem('userToken');
      if (!token) {
        setNotifError('Please log in to view notifications');
        setNotifLoading(false);
        return;
      }
      const page = reset ? 1 : dmPageRef.current;
      const per_page = dmPerPageRef.current;
      const res = await fetch(`${apiEndpoints.baseURL}/api/notifications?page=${page}&per_page=${per_page}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        // 404 -> no notifications is okay
        if (res.status === 404) {
          if (reset) setDmNotifs([]);
          setHasMoreDm(false);
        } else {
          throw new Error(`HTTP ${res.status}`);
        }
      } else {
        const json = await res.json();
        const items: DMNotification[] = json.notifications || [];
        if (reset) {
          setDmNotifs(items);
        } else {
          setDmNotifs((prev) => [...prev, ...items]);
        }
        const { total_pages } = json.pagination || { total_pages: 1 };
        dmPageRef.current = page + 1;
        setHasMoreDm(dmPageRef.current <= total_pages);
      }
    } catch (e) {
      setNotifError((e as Error)?.message || 'Failed to load notifications');
    } finally {
      setNotifLoading(false);
    }
  };

  const fetchBandInvitations = async () => {
    let token = '';
    let authCode = '';
    
    try {
      setLoading(true);
      setError(null);
      
      const tokenRaw = await AsyncStorage.getItem('userToken');
      token = tokenRaw ?? '';
      if (!token) {
        setError('Please log in to view your band invitations');
        setLoading(false);
        return;
      }

      // Get additional auth data if available
      const userDataString = await AsyncStorage.getItem('userData');
      if (userDataString) {
        try {
          const userData = JSON.parse(userDataString);
          // Check if authcode exists in user data
          authCode = userData.authcode || userData.auth_code || userData.code || '';
          console.log('Fetch invitations - Auth data available:', { 
            hasAuthCode: !!authCode, 
            authCodeLength: authCode.length,
            userDataKeys: Object.keys(userData),
            fullUserData: userData // Log the full user data to see what's available
          });
        } catch (e) {
          console.log('Could not parse user data for authcode');
        }
      }

      const url = new URL(`${apiEndpoints.bands}/invites`);
      if (authCode) {
        url.searchParams.append('authcode', authCode);
        url.searchParams.append('auth_code', authCode);
        url.searchParams.append('code', authCode);
      }

      console.log('Fetching invitations with URL:', url.toString());
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          ...(authCode ? { 'X-Auth-Code': authCode } : {}),
        },
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'No response body');
        let errorMessage = `Failed to fetch invitations: ${response.status} ${response.statusText}`;
        
        try {
          const errorData = JSON.parse(errorText);
          if (errorData.error) {
            errorMessage = `${errorMessage} - ${errorData.error}`;
          } else if (errorData.message) {
            errorMessage = `${errorMessage} - ${errorData.message}`;
          }
        } catch (e) {
          if (errorText && errorText !== 'No response body') {
            errorMessage = `${errorMessage} - ${errorText}`;
          }
        }
        
        console.log('Fetch invitations error response:', {
          status: response.status,
          statusText: response.statusText,
          errorText: errorText,
          url: url.toString(),
          headers: {
            'Authorization': `Bearer ${token}`,
            ...(authCode ? { 'X-Auth-Code': authCode } : {}),
          }
        });
        
        if (response.status === 401) {
          throw new Error('Session expired. Please log in again.');
        } else if (response.status === 404) {
          // No invitations found is not an error
          setBandInvitations([]);
          return;
        } else {
          throw new Error(errorMessage);
        }
      }

      const data = await response.json();
      
      // Ensure data is an array
      if (Array.isArray(data)) {
        setBandInvitations(data);
      } else if (data && typeof data === 'object' && data.invitations) {
        setBandInvitations(data.invitations);
      } else {
        setBandInvitations([]);
      }
    } catch (err) {
      console.error('Error fetching band invitations:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch invitations';
      setError(errorMessage);
      
      // Clear invitations on error
      setBandInvitations([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBandInvitations();
    fetchDmNotifications(true);
  }, []);

  useEffect(() => {
    let unsub: (() => void) | null = null;
    (async () => {
      const token = await AsyncStorage.getItem('userToken');
      const s = await chatSocket.init(apiEndpoints.baseURL, token ?? undefined);
      if (!s) return;
      const handler = () => {
        // Refetch DM notifications when a new message notify arrives
        fetchDmNotifications(true);
      };
      chatSocket.on('notify:new_message', handler);
      unsub = () => chatSocket.off('notify:new_message', handler);
    })();
    return () => { if (unsub) try { unsub(); } catch { /* ignore */ } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRefresh = async () => {
    await fetchBandInvitations();
    await fetchDmNotifications(true);
    runRefresh();
  };

  const openDM = (n: DMNotification) => {
    const p = n.payload;
    if (p && p.sender_type && p.sender_id && p.receiver_type && p.receiver_id) {
      router.push(`/chats?sender_type=${p.sender_type}&sender_id=${p.sender_id}&receiver_type=${p.receiver_type}&receiver_id=${p.receiver_id}`);
    }
  };

  const dismissDM = async (n: DMNotification) => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) return;
      await fetch(`${apiEndpoints.baseURL}/api/notifications/${n.notification_id}/dismiss`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        }
      });
      setDmNotifs((prev) => prev.filter((x) => x.notification_id !== n.notification_id));
    } catch (e) {}
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <SvgXml xml={ArrowLeftIcon} width="24" height="24" />
          </View>
          <Text style={styles.headerTitle}>Notifications</Text>
        </View>

        {/* Notifications List */}
        <ScrollView 
          style={styles.notificationsList} 
          refreshControl={refreshControl}
          onScroll={(e) => {
            if (e.nativeEvent.contentOffset.y === 0) {
              handleRefresh();
            }
          }}
        >
          {/* Direct Message Notifications Section */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Message Notifications</Text>
            {notifLoading && (
              <View style={{ paddingVertical: 8 }}>
                <ActivityIndicator size="small" color="#151414" />
              </View>
            )}
            {notifError && (
              <Text style={{ color: '#ef4444', fontFamily: 'Manrope-500' }}>{notifError}</Text>
            )}
            {dmNotifs.map((n) => (
              <DMNotificationItem key={n.notification_id} item={n} onOpen={() => openDM(n)} onDismiss={() => dismissDM(n)} />
            ))}
            {hasMoreDm && !notifLoading && (
              <TouchableOpacity style={{ paddingHorizontal: 16, paddingVertical: 12 }} onPress={() => fetchDmNotifications(false)}>
                <Text style={{ color: '#16120f', fontFamily: 'Manrope-600' }}>Load more</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Band Invitations Section */}
          {loading && bandInvitations.length === 0 ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#151414" />
              <Text style={styles.loadingText}>Loading invitations...</Text>
            </View>
          ) : error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
              {error.includes('log in') ? (
                <TouchableOpacity style={styles.loginButton} onPress={() => router.push('/sign-in')}>
                  <Text style={styles.loginButtonText}>Go to Login</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.retryButton} onPress={fetchBandInvitations}>
                  <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <>
              {bandInvitations.length > 0 && (
                <View style={styles.sectionContainer}>
                  <Text style={styles.sectionTitle}>Band Invitations</Text>
                  {bandInvitations.map((invitation) => (
                    <BandInvitationItem 
                      key={invitation.invite_id} 
                      invitation={invitation} 
                      onStatusUpdate={fetchBandInvitations}
                    />
                  ))}
                </View>
              )}

              {/* Regular Notifications Section */}
              <View style={styles.sectionContainer}>
                <Text style={styles.sectionTitle}>General Notifications</Text>
                {notifications.map((notif, index) => (
                  <NotificationItem key={index} message={notif.message} time={notif.time} />
                ))}
              </View>
            </>
          )}
          <View style={styles.spacer} />
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f3ede6',
  },
  container: {
    flex: 1,
    backgroundColor: '#f3ede6',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 8,
    backgroundColor: '#f3ede6',
  },
  headerIcon: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    paddingRight: 48,
    fontFamily: 'Manrope-700',
    color: '#151414',
  },
  notificationsList: {
    flex: 1,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: '#f3ede6',
    paddingHorizontal: 16,
    minHeight: 72,
    paddingVertical: 8,
    justifyContent: 'space-between',
  },
  iconContainer: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#fffbf7',
    flexShrink: 0,
  },
  notificationTextContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  notificationMessage: {
    fontSize: 16,
    fontWeight: '500',
    fontFamily: 'Manrope-500',
    color: '#151414',
    lineHeight: 24,
  },
  notificationTime: {
    fontSize: 14,
    fontWeight: '400',
    fontFamily: 'Manrope-400',
    color: '#77726E',
    lineHeight: 20,
  },
  caretIconContainer: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  spacer: {
    height: 20,
    backgroundColor: '#f3ede6',
  },
  sectionContainer: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: 'Manrope-700',
    color: '#151414',
    marginHorizontal: 16,
    marginVertical: 12,
  },
  invitationItem: {
    backgroundColor: '#f3ede6',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5ddd4',
  },
  invitationContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    minHeight: 88,
    justifyContent: 'space-between',
  },
  invitationTextContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  invitationTitle: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Manrope-600',
    color: '#151414',
    lineHeight: 24,
    marginBottom: 2,
  },
  invitationDetails: {
    fontSize: 14,
    fontWeight: '400',
    fontFamily: 'Manrope-400',
    color: '#77726E',
    lineHeight: 20,
    marginBottom: 2,
  },
  invitationStatus: {
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  invitationTime: {
    fontSize: 12,
    fontWeight: '400',
    fontFamily: 'Manrope-400',
    color: '#9c9488',
    lineHeight: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '400',
    fontFamily: 'Manrope-400',
    color: '#77726E',
  },
  errorContainer: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontSize: 14,
    fontWeight: '400',
    fontFamily: 'Manrope-400',
    color: '#ef4444',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#151414',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Manrope-600',
  },
  loginButton: {
    backgroundColor: '#151414',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  loginButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Manrope-600',
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
    justifyContent: 'flex-end',
  },
  actionButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptButton: {
    backgroundColor: '#10b981',
  },
  rejectButton: {
    backgroundColor: '#ef4444',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Manrope-600',
  },
  acceptButtonText: {
    color: '#ffffff',
  },
  rejectButtonText: {
    color: '#ffffff',
  },
});

export default Notification;
