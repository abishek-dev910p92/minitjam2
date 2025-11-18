import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SvgXml } from 'react-native-svg';
import usePullToRefresh from './_utils/usePullToRefresh';
const ArrowLeftIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24px" height="24px" fill="currentColor" viewBox="0 0 256 256"><path d="M224,128a8,8,0,0,1-8,8H59.31l58.35,58.34a8,8,0,0,1-11.32,11.32l-72-72a8,8,0,0,1,0-11.32l72-72a8,8,0,0,1,11.32,11.32L59.31,120H216A8,8,0,0,1,224,128Z"></path></svg>`;

const AboutUsScreen = () => {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerIcon}>
            <SvgXml xml={ArrowLeftIcon} width="24" height="24" fill="#151414" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>About Us</Text>
        </View>

  {/* Add pull-to-refresh (no-op) for consistent UX */}
  <ScrollView contentContainerStyle={styles.scrollViewContent} refreshControl={usePullToRefresh().refreshControl}>
          <Text style={styles.sectionHeader}>Our Mission</Text>
          <Text style={styles.paragraph}>
            At StageUp, we&apos;re dedicated to empowering artists by simplifying the venue booking process. Our platform connects performers with a diverse range of venues, providing tools and resources to help them secure gigs and grow their careers.
          </Text>

          <Text style={styles.sectionHeader}>Key Features</Text>
          <Text style={styles.paragraph}>
            StageUp offers a comprehensive suite of features designed to streamline the booking experience for artists. From browsing venues and submitting proposals to managing bookings and communicating with venue managers, our platform provides all the tools you need to succeed.
          </Text>
          
          <Text style={styles.versionText}>Version v1.0.0</Text>
          <TouchableOpacity>
            <Text style={styles.linkText}>Terms of Service</Text>
          </TouchableOpacity>
          <TouchableOpacity>
            <Text style={styles.linkText}>Privacy Policy</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 8,
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
    color: '#151414',
  },
  scrollViewContent: {
    paddingBottom: 20,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: 'bold',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 8,
    color: '#151414',
  },
  paragraph: {
    fontSize: 14,
    fontWeight: 'normal',
    lineHeight: 24,
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: 4,
    color: '#151414',
  },
  versionText: {
    fontSize: 14,
    fontWeight: 'normal',
    lineHeight: 20,
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: 4,
    color: '#77726E',
  },
  linkText: {
    fontSize: 14,
    fontWeight: 'normal',
    lineHeight: 20,
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: 4,
    color: '#77726E',
    textDecorationLine: 'underline',
  },
});
 
export default AboutUsScreen;