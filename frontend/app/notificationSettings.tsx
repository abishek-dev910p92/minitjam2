import { router } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SvgXml } from 'react-native-svg';
const ArrowLeftIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="#16120f" viewBox="0 0 256 256"><path d="M224,128a8,8,0,0,1-8,8H59.31l58.35,58.34a8,8,0,0,1-11.32,11.32l-72-72a8,8,0,0,1,0-11.32l72-72a8,8,0,0,1,11.32,11.32L59.31,120H216A8,8,0,0,1,224,128Z"></path></svg>`;

const NotificationSwitch = ({ 
  label, 
  description, 
  initialState = false 
}: {
  label: string;
  description: string;
  initialState?: boolean;
}) => {
  const [isEnabled, setIsEnabled] = useState(initialState);
  const toggleSwitch = () => setIsEnabled(previousState => !previousState);

  return (
    <View style={styles.switchContainer}>
      <View style={styles.textContainer}>
        <Text style={styles.switchLabel}>{label}</Text>
        <Text style={styles.switchDescription}>{description}</Text>
      </View>
      <TouchableOpacity
        onPress={toggleSwitch}
        style={[styles.toggleBase, isEnabled ? styles.toggleEnabled : styles.toggleDisabled]}
      >
        <View style={styles.toggleCircle} />
      </TouchableOpacity>
    </View>
  );
};

const notificationSettings = () => {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <SvgXml xml={ArrowLeftIcon} width="24" height="24" fill="#16120f" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Notifications</Text>
        </View>

        <ScrollView>
          <NotificationSwitch label="Allow Notifications" description="Turn on all notifications" />

          <Text style={styles.sectionHeader}>Messages</Text>
          <NotificationSwitch label="New Messages" description="When someone sends you a message" />

          <Text style={styles.sectionHeader}>Bookings</Text>
          <NotificationSwitch label="Booking Requests" description="When someone requests to book you" />
          <NotificationSwitch label="Booking Confirmations" description="When a booking is confirmed" />
          <NotificationSwitch label="Booking Cancellations" description="When a booking is cancelled" />

          <Text style={styles.sectionHeader}>Events</Text>
          <NotificationSwitch label="New Events" description="When new events are posted" />
          <NotificationSwitch label="Event Updates" description="When an event you're interested in changes" />

          <Text style={styles.sectionHeader}>System</Text>
          <NotificationSwitch label="App Updates" description="Updates about the app" />
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
  },
  backButton: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontFamily: 'Manrope-700',
    color: '#16120f',
    textAlign: 'center', 
    paddingRight: 48,
  },
  sectionHeader: {
    fontSize: 14,
    fontFamily: 'Manrope-700',
    color: '#16120f',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    minHeight: 72,
    paddingVertical: 8,
    justifyContent: 'space-between',
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  switchLabel: {
    fontSize: 14,
    fontFamily: 'Manrope-500',
    color: '#16120f',
    lineHeight: 24,
  },
  switchDescription: {
    fontSize: 14,
    fontFamily: 'Manrope-400',
    color: '#B1ADAA',
    lineHeight: 20,
  },
  toggleBase: {
    width: 51,
    height: 31,
    borderRadius: 31 / 2,
    padding: 2,
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  toggleEnabled: {
    backgroundColor: '#fff',
    alignItems: 'flex-end',
  },
  toggleDisabled: {
    alignItems: 'flex-start',
  },
  toggleCircle: {
    width: 27,
    height: 27,
    borderRadius: 27 / 2,
    backgroundColor: '#16120f',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
});

export default notificationSettings;