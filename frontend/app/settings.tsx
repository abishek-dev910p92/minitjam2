import { Link, router } from 'expo-router';
import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import useAuthStore from './_utils/authStore';
import usePullToRefresh from './_utils/usePullToRefresh';

// --- Icon Components ---
const ArrowLeftIcon = () => (
  <Svg height="24" width="24" viewBox="0 0 256 256">
    <Path
      fill="black"
      d="M224,128a8,8,0,0,1-8,8H59.31l58.35,58.34a8,8,0,0,1-11.32,11.32l-72-72a8,8,0,0,1,0-11.32l72-72a8,8,0,0,1,11.32,11.32L59.31,120H216A8,8,0,0,1,224,128Z"
    />
  </Svg>
);

const ArrowRightIcon = () => (
  <Svg height="24" width="24" viewBox="0 0 256 256">
    <Path
      fill="#9CA3AF" // Medium gray for contrast
      d="M221.66,133.66l-72,72a8,8,0,0,1-11.32-11.32L196.69,136H40a8,8,0,0,1,0-16H196.69L138.34,61.66a8,8,0,0,1,11.32-11.32l72,72A8,8,0,0,1,221.66,133.66Z"
    />
  </Svg>
);

// --- Reusable Settings Item Component ---
const SettingsItem = ({ label, path }: { label: string, path: string }) => (
    <Link href={path as any} asChild >
    <TouchableOpacity style={styles.settingsItem}>
      {/* The `asChild` prop is crucial here */}
      {/* It passes the `href` and other props to its child, `TouchableOpacity` */}
      <Text style={styles.itemTextnormal}>{label}</Text>
      <ArrowRightIcon />
    </TouchableOpacity>
  </Link>
);


// --- Main Screen Component ---
export default function SettingsScreen() {
  const {logOut} = useAuthStore();

  return (
    <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          
        <TouchableOpacity style={styles.iconContainer} onPress={() => router.back()}>
          <ArrowLeftIcon />
        </TouchableOpacity> 
        <Text style={styles.headerTitle}>Settings</Text>
      </View>
   

      {/* Settings List */}
  <ScrollView refreshControl={usePullToRefresh().refreshControl}>
     <SettingsItem label="Account's" path="/Accounts" />
      <SettingsItem label="Privacy" path="/privacy" />
      <SettingsItem label="Notifications" path="/notificationSettings"  />
        <SettingsItem label="Linked Accounts" path="/linkedAccounts"  />
        <SettingsItem label="Help & Support" path="/helpSupport"  />
        <SettingsItem label="About us"  path="/Aboutus"  />
        <TouchableOpacity style={styles.settingsItem} onPress={logOut}>
          <Text style={styles.itemText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

// --- Stylesheet ---
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f3ede6',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',  
    paddingHorizontal: 16,  
    paddingVertical: 8,
    borderBottomWidth: 1, 
    borderBottomColor: '#E5E7EB', // Light separator line
  },
  iconContainer: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: '#111827',
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 48, // Balance the left icon for centering

  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16, 
    minHeight: 56,
    borderBottomWidth: 1,
    borderBottomColor: '#f3ede6',
     
  },
  itemTextnormal: {
     fontSize: 15,
    flex: 1,
    textAlign: 'left',
  },
  itemText: {
    fontSize: 18,
    color: 'red',
    fontWeight: 500,
    marginLeft: 3,
    flex: 1,
    textAlign: 'left',
  },
});
