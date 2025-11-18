import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, Modal, Text, TextInput, TouchableOpacity, View } from 'react-native';
import apiEndpoints from '../api/baseUrl';

type Artist = { artist_id: number; name: string; profile_image_url?: string | null };

export default function SearchArtistModal({ bandId, visible, onClose, onInviteSuccess }: { bandId: number; visible: boolean; onClose: () => void; onInviteSuccess?: () => void }) {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Artist[]>([]);
  const [invitingId, setInvitingId] = useState<number | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 500);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (!debounced) { setResults([]); return; }
    let cancelled = false;
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      try {
        const token = await AsyncStorage.getItem('userToken');
        if (!token) throw new Error('Auth required');
        const url = `${apiEndpoints.artistSearch}?q=${encodeURIComponent(debounced)}`;
        const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal });
        if (!res.ok) throw new Error(`Search failed (${res.status})`);
  const json = await res.json();
  const items = Array.isArray(json) ? json : (json?.items ?? json?.data ?? []);
  if (!cancelled) setResults(items);
      } catch (e) {
        if ((e as any)?.name === 'AbortError') return;
        console.error('Artist search error', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; controller.abort(); };
  }, [debounced]);

  const sendInvite = async (artistId: number) => {
    setInvitingId(artistId);
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) throw new Error('Auth required');
      const url = `${apiEndpoints.bands}/${bandId}/invite`;
      const body = { artist_id: artistId, role: 'member' };
      console.debug('[Invite] Request', { url, body });
      const res = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

      // debug response body safely
      let parsedBody: any = null;
      try { parsedBody = await res.clone().json(); } catch (e) { try { parsedBody = await res.clone().text(); } catch { parsedBody = null; } }
      console.debug('[Invite] Response', { status: res.status, body: parsedBody });

      if (!res.ok) {
        // try to parse JSON error bodies for a friendlier message
        let errMsg = `Invite failed (${res.status})`;
        try {
          const errJson = parsedBody ?? await res.json();
          // common shapes: { error: '...', message: '...' }
          errMsg = errJson?.error ?? errJson?.message ?? JSON.stringify(errJson);
        } catch (_) {
          try {
            const text = typeof parsedBody === 'string' ? parsedBody : await res.text();
            if (text) errMsg = text;
          } catch { /* ignore */ }
        }
        Alert.alert('Error', errMsg);
        return;
      }

      const successBody = parsedBody ?? await res.json();
      console.debug('[Invite] Success body', successBody);
      Alert.alert('Success', 'Invitation sent!');
      onInviteSuccess && onInviteSuccess();
      onClose();
    } catch (e) {
      // If something unexpected happened, show a friendly message and log the real error for debugging
  console.error('Invite error', e);
  const em: any = e;
  Alert.alert('Error', typeof e === 'string' ? e : (em?.message ?? 'Failed to send invite.'));
    } finally {
      setInvitingId(null);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center' }}>
        <View style={{ margin: 16, backgroundColor: '#fff', borderRadius: 12, padding: 12, maxHeight: '80%' }}>
          <Text style={{ fontWeight: '600', fontSize: 16, marginBottom: 8 }}>Search artists to invite</Text>
          <TextInput placeholder="Search by name" value={query} onChangeText={setQuery} style={{ borderWidth: 1, borderColor: '#ddd', padding: 8, borderRadius: 8, marginBottom: 8 }} />
          {loading ? <ActivityIndicator /> : null}

          {results.length === 0 && !loading ? (
            <Text style={{ textAlign: 'center', color: '#666', marginTop: 8 }}>No artists found.</Text>
          ) : (
            <FlatList
              data={results}
              keyExtractor={(i) => String(i.artist_id)}
              renderItem={({ item }) => (
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f1f1' }}>
                  {item.profile_image_url && item.profile_image_url.length > 0 ? <Image source={{ uri: item.profile_image_url }} style={{ width: 40, height: 40, borderRadius: 20, marginRight: 12 }} /> : <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#ddd', marginRight: 12 }} />}
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '600' }}>{item.name}</Text>
                  </View>
                  <TouchableOpacity disabled={invitingId === item.artist_id} onPress={() => sendInvite(item.artist_id)} style={{ paddingHorizontal: 12, paddingVertical: 8, backgroundColor: invitingId === item.artist_id ? '#ccc' : '#6b6057', borderRadius: 8 }}>
                    <Text style={{ color: '#fff' }}>{invitingId === item.artist_id ? 'Inviting...' : 'Invite'}</Text>
                  </TouchableOpacity>
                </View>
              )}
            />
          )}

          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 }}>
            <TouchableOpacity onPress={onClose} style={{ padding: 8 }}>
              <Text>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
