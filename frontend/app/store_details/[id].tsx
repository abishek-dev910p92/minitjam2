import { Link, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import apiEndpoints from '../api/baseUrl';

interface MusicStore {
  id: number;
  name: string;
  address_1?: string;
  address_2?: string;
  phone_number?: string;
  rating?: number | string;
}

export default function StoreDetailsScreen() {
  const params = useLocalSearchParams();
  const id = typeof params?.id === 'string' ? params.id : '';
  const [store, setStore] = useState<MusicStore | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStore = async () => {
      if (!id) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${apiEndpoints.musicStores}/${encodeURIComponent(id)}`);
        if (!res.ok) {
          const text = await res.text().catch(() => '');
          throw new Error(text || `Failed to load store (${res.status})`);
        }
        const json = await res.json();
        setStore(json as MusicStore);
      } catch (e: any) {
        setError(e?.message || 'Failed to load store');
      } finally {
        setLoading(false);
      }
    };
    fetchStore();
  }, [id]);

  const initial = (store?.name?.[0] || '?').toUpperCase();

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Link href="/(tabs)" asChild>
          <TouchableOpacity style={styles.backButton}><Text style={styles.backText}>← Back</Text></TouchableOpacity>
        </Link>

        {loading && <Text style={styles.secondary}>Loading store...</Text>}
        {error && <Text style={styles.secondary}>Error: {error}</Text>}
        {store && (
          <View style={styles.card}>
            <View style={styles.avatar}><Text style={styles.avatarText}>{initial}</Text></View>
            <Text style={styles.title}>{store.name}</Text>
            {!!store.address_1 && <Text style={styles.secondary}>{store.address_1}</Text>}
            {!!store.address_2 && <Text style={styles.secondary}>{store.address_2}</Text>}
            {store.rating !== undefined && (
              <Text style={styles.secondary}>Rating {String(store.rating)}</Text>
            )}
            {!!store.phone_number && (
              <TouchableOpacity style={styles.callButton} onPress={() => Linking.openURL(`tel:${store.phone_number}`)}>
                <Text style={styles.callButtonText}>📞 Call {store.phone_number}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f3ede6' },
  container: { padding: 16 },
  backButton: { marginBottom: 12 },
  backText: { fontSize: 16, color: '#151414' },
  card: { backgroundColor: '#fffbf7', borderRadius: 12, padding: 16, gap: 8 },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#e8e4de', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 22, fontWeight: 'bold', color: '#151414' },
  title: { fontSize: 20, fontWeight: 'bold', color: '#151414' },
  secondary: { fontSize: 14, color: '#77726e' },
  callButton: { marginTop: 10, backgroundColor: '#6b6057', paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  callButtonText: { color: '#f3ede6', fontWeight: 'bold' },
});