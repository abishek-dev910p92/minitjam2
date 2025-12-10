import { router } from 'expo-router'
import React, { useEffect, useMemo, useState } from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Alert, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import apiEndpoints from './api/baseUrl'

type PrivacyPrefs = {
  showMobile: boolean
  showEmail: boolean
}

const STORAGE_KEY = 'privacy:prefs'

export default function PrivacyScreen() {
  const [prefs, setPrefs] = useState<PrivacyPrefs>({ showMobile: false, showEmail: false })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadPrefs = async () => {
    setError(null)
    setLoading(true)
    try {
      const token = await AsyncStorage.getItem('userToken')
      if (token) {
        const res = await fetch(apiEndpoints.baseURL + 'privacy', { headers: { Authorization: `Bearer ${token}` } })
        if (res.ok) {
          const j = await res.json()
          const next = { showMobile: !!j.show_mobile, showEmail: !!j.show_email }
          setPrefs(next)
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next))
        } else {
          const raw = await AsyncStorage.getItem(STORAGE_KEY)
          if (raw) {
            const j = JSON.parse(raw)
            setPrefs({ showMobile: !!j.showMobile, showEmail: !!j.showEmail })
          } else {
            setPrefs({ showMobile: false, showEmail: false })
          }
        }
      } else {
        const raw = await AsyncStorage.getItem(STORAGE_KEY)
        if (raw) {
          const j = JSON.parse(raw)
          setPrefs({ showMobile: !!j.showMobile, showEmail: !!j.showEmail })
        } else {
          setPrefs({ showMobile: false, showEmail: false })
        }
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load preferences')
    } finally {
      setLoading(false)
    }
  }

  const savePrefs = async (next: PrivacyPrefs) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      setPrefs(next)
      const token = await AsyncStorage.getItem('userToken')
      if (token) {
        await fetch(apiEndpoints.baseURL + 'privacy', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ show_email: next.showEmail, show_mobile: next.showMobile })
        })
      }
    } catch (e: any) {
      Alert.alert('Error', 'Failed to save preferences')
    }
  }

  useEffect(() => {
    loadPrefs()
  }, [])

  const headerTitle = useMemo(() => 'Privacy', [])

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconContainer} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back">
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{headerTitle}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {loading ? (
          <View style={styles.loadingRow}>
            <Text style={styles.loadingText}>Loading…</Text>
          </View>
        ) : error ? (
          <View style={styles.errorRow}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={loadPrefs} accessibilityRole="button" accessibilityLabel="Retry loading preferences">
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.section}>
            <View style={styles.toggleRow} accessible accessibilityRole="switch" accessibilityLabel="Show Mobile Number">
              <View style={styles.toggleTextWrap}>
                <Text style={styles.toggleLabel}>Show Mobile Number</Text>
                <Text style={styles.toggleHint}>Allow others to see your phone number</Text>
              </View>
              <Switch
                value={prefs.showMobile}
                onValueChange={(v) => savePrefs({ ...prefs, showMobile: v })}
                accessibilityLabel="Show Mobile Number"
              />
            </View>
            <View style={styles.divider} />
            <View style={styles.toggleRow} accessible accessibilityRole="switch" accessibilityLabel="Show Email">
              <View style={styles.toggleTextWrap}>
                <Text style={styles.toggleLabel}>Show Email</Text>
                <Text style={styles.toggleHint}>Allow others to see your email address</Text>
              </View>
              <Switch
                value={prefs.showEmail}
                onValueChange={(v) => savePrefs({ ...prefs, showEmail: v })}
                accessibilityLabel="Show Email"
              />
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f3ede6' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  iconContainer: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 18, color: '#111827' },
  headerTitle: { flex: 1, textAlign: 'center', color: '#111827', fontSize: 18, fontWeight: 'bold', marginRight: 48 },
  content: { padding: 16 },
  section: { backgroundColor: '#fff', borderRadius: 12, padding: 16 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
  toggleTextWrap: { flex: 1, paddingRight: 12 },
  toggleLabel: { color: '#111827', fontSize: 16, fontWeight: '600' },
  toggleHint: { color: '#6B7280', fontSize: 13, marginTop: 2 },
  divider: { height: 1, backgroundColor: '#F3F4F6', marginVertical: 8 },
  loadingRow: { paddingVertical: 24, alignItems: 'center' },
  loadingText: { color: '#6B7280' },
  errorRow: { gap: 8, alignItems: 'center' },
  errorText: { color: '#ef4444' },
  retryButton: { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#111827', borderRadius: 8 },
  retryText: { color: '#fff' },
})

