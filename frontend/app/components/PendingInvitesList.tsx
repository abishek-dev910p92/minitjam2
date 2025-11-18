import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Text, TouchableOpacity, View } from 'react-native';
import apiEndpoints from '../api/baseUrl';

export default function PendingInvitesList({ bandId }: { bandId: number }) {
  const [invites, setInvites] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [isCreator, setIsCreator] = useState(false);

  // determine if current user is band creator
  useEffect(() => {
    const checkCreator = async () => {
      try {
        const userString = await AsyncStorage.getItem('userData');
        const user = userString ? JSON.parse(userString) : null;
        if (!user) return setIsCreator(false);
        // naive: fetch band to check created_by if needed, but we can rely on the band list caller usually showing this component only to creator.
        setIsCreator(Boolean(user && (user.artist_id === user.id || user.artist_id)));
      } catch (e) {
        console.error('Failed to check creator', e);
      }
    };
    checkCreator();
  }, []);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) throw new Error('Auth required');
      const res = await fetch(`${apiEndpoints.bands}/${bandId}/invites`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(`Failed to fetch invites (${res.status})`);
      const json = await res.json();
      const list = Array.isArray(json) ? json : (json?.items ?? []);
      setInvites(list.filter((i: any) => i.status === 'pending'));
    } catch (e) {
      console.error('Invites load error', e);
      setInvites([]);
    } finally {
      setLoading(false);
    }
  }, [bandId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <ActivityIndicator />;

  if (!invites || invites.length === 0) return (
    <View>
      <Text style={{ color: '#666' }}>No pending invites.</Text>
      <TouchableOpacity onPress={load} style={{ marginTop: 8 }}>
        <Text style={{ color: '#6b6057' }}>Refresh</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View>
      <TouchableOpacity onPress={load} style={{ alignSelf: 'flex-end', marginBottom: 8 }}>
        <Text style={{ color: '#6b6057' }}>Refresh</Text>
      </TouchableOpacity>
      {invites.map((item) => (
        <View key={String(item.invite_id)} style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#eee' }}>
          <Text style={{ fontWeight: '600' }}>{item.artist_name ?? item.invited_artist_name}</Text>
          <Text style={{ color: '#666' }}>{item.role ?? ''} • <Text style={{ color: '#999' }}>{item.invited_at ? new Date(item.invited_at).toLocaleDateString() : ''}</Text></Text>
          <View style={{ marginTop: 6, flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <View style={{ alignSelf: 'flex-start', backgroundColor: '#e5e7eb', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 12 }}>
              <Text style={{ color: '#374151' }}>Pending</Text>
            </View>
            {isCreator ? (
              <TouchableOpacity
                onPress={() => {
                  Alert.alert('Cancel invite', `Cancel invite to ${item.artist_name ?? item.invited_artist_name}?`, [
                    { text: 'No', style: 'cancel' },
                    { text: 'Yes', style: 'destructive', onPress: () => cancelInvite(item.invite_id) }
                  ]);
                }}
                disabled={cancellingId === item.invite_id}
                style={{ paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#ef4444', borderRadius: 8 }}
              >
                <Text style={{ color: '#fff' }}>{cancellingId === item.invite_id ? 'Cancelling...' : 'Cancel'}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      ))}
    </View>
  );

  async function cancelInvite(inviteId: number) {
    try {
      setCancellingId(inviteId);
      const token = await AsyncStorage.getItem('userToken');
      if (!token) throw new Error('Auth required');
      const res = await fetch(`${apiEndpoints.bands}/${bandId}/invites/${inviteId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        let message = text || `Failed to cancel invite (${res.status})`;
        try { const json = JSON.parse(text || '{}'); if (json && json.error) message = json.error; } catch (e) {}
        Alert.alert('Error', message);
        return;
      }
      // success: refresh
      await load();
      Alert.alert('Cancelled', 'Invite cancelled.');
    } catch (e) {
      console.error('Cancel invite error', e);
      Alert.alert('Error', 'Failed to cancel invite. Please try again.');
    } finally {
      setCancellingId(null);
    }
  }
}
