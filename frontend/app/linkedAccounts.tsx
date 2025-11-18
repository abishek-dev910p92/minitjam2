import AsyncStorage from '@react-native-async-storage/async-storage';
import { Link, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Dimensions, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SvgXml } from 'react-native-svg';
import useUserData from './_utils/Localstorage';
import apiEndpoints from './api/baseUrl';
const { width } = Dimensions.get('window');

const ArrowLeftIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24px" height="24px" fill="currentColor" viewBox="0 0 256 256"><path d="M224,128a8,8,0,0,1-8,8H59.31l58.35,58.34a8,8,0,0,1-11.32,11.32l-72-72a8,8,0,0,1,0-11.32l72-72a8,8,0,0,1,11.32,11.32L59.31,120H216A8,8,0,0,1,224,128Z"></path></svg>`;
const InstagramLogo = `<svg xmlns="http://www.w3.org/2000/svg" width="24px" height="24px" fill="currentColor" viewBox="0 0 256 256"><path d="M128,80a48,48,0,1,0,48,48A48.05,48.05,0,0,0,128,80Zm0,80a32,32,0,1,1,32-32A32,32,0,0,1,128,160ZM176,24H80A56.06,56.06,0,0,0,24,80v96a56.06,56.06,0,0,0,56,56h96a56.06,56.06,0,0,0,56-56V80A56.06,56.06,0,0,0,176,24Zm40,152a40,40,0,0,1-40,40H80a40,40,0,0,1-40-40V80A40,40,0,0,1,80,40h96a40,40,0,0,1,40,40ZM192,76a12,12,0,1,1-12-12A12,12,0,0,1,192,76Z"></path></svg>`;
const SpotifyLogo = `<svg xmlns="http://www.w3.org/2000/svg" width="24px" height="24px" fill="currentColor" viewBox="0 0 256 256"><path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm31.07-46.26a8,8,0,0,1-10.81,3.33,42.79,42.79,0,0,0-40.52,0,8,8,0,0,1-7.48-14.14,59.33,59.33,0,0,1,55.48,0A8,8,0,0,1,159.07,169.74Zm32-56a8,8,0,0,1-10.83,3.29,110.62,110.62,0,0,0-104.46,0,8,8,0,0,1-7.54-14.12,126.67,126.67,0,0,1,119.54,0A8,8,0,0,1,191.06,113.76Zm-16,28a8,8,0,0,1-10.82,3.3,77,77,0,0,0-72.48,0,8,8,0,0,1-7.52-14.12,93,93,0,0,1,87.52,0A8,8,0,0,1,175.06,141.76Z"></path></svg>`;
const YoutubeLogo = `<svg xmlns="http://www.w3.org/2000/svg" width="24px" height="24px" fill="currentColor" viewBox="0 0 256 256"><path d="M164.44,121.34l-48-32A8,8,0,0,0,104,96v64a8,8,0,0,0,12.44,6.66l48-32a8,8,0,0,0,0-13.32ZM120,145.05V111l25.58,17ZM234.33,69.52a24,24,0,0,0-14.49-16.4C185.56,39.88,131,40,128,40s-57.56-.12-91.84,13.12a24,24,0,0,0-14.49,16.4C19.08,79.5,16,97.74,16,128s3.08,48.5,5.67,58.48a24,24,0,0,0,14.49,16.41C69,215.56,120.4,216,127.34,216h1.32c6.94,0,58.37-.44,91.18-13.11a24,24,0,0,0,14.49-16.41c2.59-10,5.67-28.22,5.67-58.48S236.92,79.5,234.33,69.52Zm-15.49,113a8,8,0,0,1-4.77,5.49c-31.65,12.22-85.48,12-86,12H128c-.54,0-54.33.2-86-12a8,8,0,0,1-4.77-5.49C34.8,173.39,32,156.57,32,128s2.8-45.39,5.16-54.47A8,8,0,0,1,41.93,68c30.52-11.79,81.66-12,85.85-12h.27c.54,0,54.38-.18,86,12a8,8,0,0,1,4.77,5.49C221.2,82.61,224,99.43,224,128S221.2,173.39,218.84,182.47Z"></path></svg>`;
const SoundcloudLogo = `<svg xmlns="http://www.w3.org/2000/svg" width="24px" height="24px" fill="currentColor" viewBox="0 0 256 256"><path d="M24,120v48a8,8,0,0,1-16,0V120a8,8,0,0,1,16,0ZM48,88a8,8,0,0,0-8,8v96a8,8,0,0,0,16,0V96A8,8,0,0,0,48,88Zm32-8a8,8,0,0,0-8,8V192a8,8,0,0,0,16,0V88A8,8,0,0,0,80,80Zm32-32a8,8,0,0,0-8,8V192a8,8,0,0,0,16,0V56A8,8,0,0,0,112,48Zm110.84,58.34A80,80,0,0,0,144,40a8,8,0,0,0,0,16,63.76,63.76,0,0,1,63.68,57.53,8,8,0,0,0,6.44,7A32,32,0,0,1,208,184H144a8,8,0,0,0,0,16h64a48,48,0,0,0,14.84-93.66Z"></path></svg>`;
const Bandlogo = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M12.1141 20.3755C12.3215 20.017 12.199 19.5582 11.8404 19.3508C11.4819 19.1434 11.0231 19.2659 10.8157 19.6245L12.1141 20.3755ZM11.4649 16L10.8157 16.3755L11.4649 16ZM12 17L11.3334 17.3438C11.492 17.6513 11.8405 17.8105 12.1769 17.7288C12.5132 17.6472 12.75 17.3461 12.75 17H12ZM12.75 8C12.75 7.58579 12.4142 7.25 12 7.25C11.5858 7.25 11.25 7.58579 11.25 8H12.75ZM8 21.25C6.20507 21.25 4.75 19.7949 4.75 18H3.25C3.25 20.6234 5.37665 22.75 8 22.75V21.25ZM4.75 18C4.75 16.2051 6.20507 14.75 8 14.75V13.25C5.37665 13.25 3.25 15.3766 3.25 18H4.75ZM10.8157 19.6245C10.2526 20.5978 9.20201 21.25 8 21.25V22.75C9.75911 22.75 11.2939 21.7934 12.1141 20.3755L10.8157 19.6245ZM8 14.75C9.20201 14.75 10.2526 15.4022 10.8157 16.3755L12.1141 15.6245C11.2939 14.2066 9.75911 13.25 8 13.25V14.75ZM10.8157 16.3755C10.8968 16.5158 11.0242 16.7535 11.1361 16.9658C11.191 17.0699 11.2404 17.1646 11.2762 17.2333C11.294 17.2676 11.3084 17.2954 11.3183 17.3145C11.3232 17.3241 11.3271 17.3315 11.3296 17.3364C11.3309 17.3389 11.3319 17.3408 11.3325 17.342C11.3328 17.3426 11.3331 17.3431 11.3332 17.3434C11.3333 17.3435 11.3334 17.3436 11.3334 17.3437C11.3334 17.3437 11.3334 17.3437 11.3334 17.3438C11.3334 17.3438 11.3334 17.3438 11.3334 17.3438C11.3334 17.3438 11.3334 17.3438 12 17C12.6666 16.6562 12.6666 16.6562 12.6666 16.6562C12.6666 16.6562 12.6666 16.6562 12.6666 16.6562C12.6665 16.6562 12.6665 16.6561 12.6665 16.6561C12.6664 16.656 12.6664 16.6558 12.6663 16.6556C12.6661 16.6553 12.6658 16.6547 12.6654 16.654C12.6647 16.6526 12.6637 16.6506 12.6623 16.6479C12.6595 16.6426 12.6555 16.6349 12.6504 16.6249C12.6401 16.6051 12.6253 16.5765 12.607 16.5412C12.5703 16.4708 12.5195 16.3735 12.463 16.2663C12.3522 16.056 12.212 15.7937 12.1141 15.6245L10.8157 16.3755ZM12.75 17V8H11.25V17H12.75Z" fill="#1C274C"></path> <path d="M16.1167 3.94199L13.4833 5.25871C13.1184 5.44117 12.9359 5.5324 12.7852 5.64761C12.3949 5.94608 12.128 6.3778 12.0357 6.86043C12 7.04673 12 7.25073 12 7.65871C12 8.6298 12 9.11535 12.1196 9.44543C12.4356 10.3178 13.3101 10.8583 14.2317 10.7508C14.5804 10.7101 15.0147 10.493 15.8833 10.0587L18.5167 8.74199C18.8816 8.55954 19.0641 8.46831 19.2148 8.35309C19.6051 8.05463 19.872 7.62291 19.9643 7.14028C20 6.95397 20 6.74998 20 6.34199C20 5.3709 20 4.88536 19.8804 4.55528C19.5644 3.68288 18.6899 3.14239 17.7683 3.24989C17.4196 3.29057 16.9853 3.50771 16.1167 3.94199Z" stroke="#1C274C" stroke-width="1.5" stroke-linecap="round"></path> </g></svg>`;
const ColabLogo = `<svg fill="#000000" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" enable-background="new 0 0 52 52" xml:space="preserve"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <g> <path d="M15.9,28c-1.4-2.1-2.1-4.5-2.1-7.2c0-4.6,1.9-8.4,4.9-10.7c-1-1.8-3-3.1-5.6-3.1c-4.4,0-6.9,3.6-6.9,7.7 c0,2.2,0.7,4.1,2.2,5.4c0.8,0.8,1.5,1.8,1.5,2.8S9.5,24.9,7,26c-3.6,1.6-6.9,3.8-7,7.1C0.1,35.3,1.5,37,3.6,37h3.3 c0.5,0,1-0.3,1.3-0.8c1.6-2.9,4.6-4.7,7.1-6C16.2,29.8,16.4,28.7,15.9,28z"></path> <path d="M45.1,26c-2.5-1.1-2.9-2-2.9-3.1s0.7-2.1,1.5-2.8c1.5-1.4,2.2-3.2,2.2-5.4c0-4.1-2.4-7.7-6.9-7.7 c-2.6,0-4.6,1.3-5.7,3.1c3,2.3,4.9,6.1,4.9,10.7c0,2.7-0.7,5.1-2.1,7.2c-0.5,0.8-0.2,1.8,0.6,2.2c2.5,1.2,5.5,3.1,7.1,6 c0.3,0.5,0.8,0.8,1.3,0.8h3.3c2.1,0,3.5-1.7,3.5-3.9C52,29.8,48.7,27.6,45.1,26z"></path> <path d="M32.7,33.3c-2.7-1.2-3.2-2.3-3.2-3.4c0-1.2,0.8-2.3,1.7-3.1c1.6-1.5,2.5-3.6,2.5-6c0-4.5-2.7-8.4-7.6-8.4 s-7.6,3.9-7.6,8.4c0,2.4,0.9,4.5,2.5,6c0.9,0.9,1.7,2,1.7,3.1c0,1.2-0.4,2.2-3.2,3.4c-4,1.7-7.8,3.6-7.9,7.2c0,2.4,1.8,4.4,4.1,4.4 h10.4h10.4c2.3,0,4.1-2,4.1-4.4C40.5,37,36.7,35.1,32.7,33.3z"></path> </g> </g></svg>`

const socialAccounts = [
  {
    name: 'Band',
    description: 'Connect your Band account to share your music and connect with fans.',
    icon: Bandlogo,
  },
   {
    name: 'Colab',
    description: 'Connect your Band account to share your music and connect with fans.',
    icon: ColabLogo,
  },
    {
    name: 'Instagram',
    description: 'Connect your Instagram account to share your music and connect with fans.',
    icon: InstagramLogo,
  },
  {
    name: 'Spotify',
    description: 'Link your Spotify account to showcase your music and reach a wider audience.',
    icon: SpotifyLogo,
  },
  {
    name: 'YouTube',
    description: 'Connect your YouTube channel to share your videos and engage with your viewers.',
    icon: YoutubeLogo,
  },
  {
    name: 'SoundCloud',
    description: 'Link your SoundCloud account to share your audio tracks and connect with other artists.',
    icon: SoundcloudLogo,
  },
];

interface Band {
  band_id: number;
  name: string;
  description: string | null;
  profile_image_url: string | null;
  created_by: number;
  created_at: string;
  updated_at: string;
  members: Array<{
    artist_id: number;
    name: string;
    role: string;
    joined_at: string;
  }>;
}

 const LinkedAccountsScreen = () => {
   const router = useRouter();
   const { user, loading: userLoading } = useUserData();
   const [bands, setBands] = useState<Band[]>([]);
   const [bandsLoading, setBandsLoading] = useState(false);
   const [bandsError, setBandsError] = useState<string | null>(null);

   const resolveBandImageUrl = (url: string | null) => {
     if (!url) return null;
     if (url.startsWith('http')) return url;
     const base = apiEndpoints.bands.replace('/bands', '/');
     return `${base}${url}`.replace('//', '/').replace(':/', '://');
   };

  const fetchBands = async () => {
    setBandsLoading(true);
    setBandsError(null);
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
      setBandsError(err instanceof Error ? err.message : 'Failed to load bands');
    } finally {
      setBandsLoading(false);
    }
  };

  useEffect(() => {
    if (user && user.artist_id) {
      fetchBands();
    }
  }, [user]);

  // Filter bands where current user is a member
  const userBands = bands.filter(band => band.members.some(m => m.artist_id === Number(user?.artist_id)));

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.headerIcon}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <SvgXml xml={ArrowLeftIcon} width="24" height="24" fill="#151414" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Linked Accounts</Text>
        </View>

        <ScrollView 
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollViewContent}
        >
          {/* User's Bands Section */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Your Bands</Text>
            {bandsLoading || userLoading ? (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Loading your bands...</Text>
              </View>
            ) : bandsError ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{bandsError}</Text>
                <TouchableOpacity 
                  style={styles.retryButton}
                  onPress={() => {
                    if (user && user.artist_id) {
                      setBandsLoading(true);
                      fetchBands();
                    }
                  }}
                >
                  <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : userBands.length === 0 ? (
              <View style={styles.emptyStateContainer}>
                <Text style={styles.emptyStateText}>You are not a member of any bands yet.</Text>
              </View>
            ) : (
               userBands.map(band => (
                 <TouchableOpacity
                   key={band.band_id}
                   onPress={() => router.push({ pathname: '/bands/band_profile_view', params: { id: band.band_id.toString() } })}
                   activeOpacity={0.7}
                   style={styles.bandCard}
                 >
                  <View style={styles.bandImageContainer}>
                    {resolveBandImageUrl(band.profile_image_url) ? (
                      <Image
                        source={{ uri: resolveBandImageUrl(band.profile_image_url)! }}
                        style={styles.thumbnailImage}
                      />
                    ) : (
                      <SvgXml xml={Bandlogo} width="28" height="28" />
                    )}
                  </View>
                   <View style={styles.bandInfoContainer}>
                     <Text style={styles.bandName}>
                       {band.name}
                     </Text>
                     {band.description ? (
                       <Text style={styles.bandDescription} numberOfLines={2}>
                         {band.description}
                       </Text>
                     ) : null}
                     <Text style={styles.bandCreatedDate}>
                       Created: {new Date(band.created_at).toLocaleDateString()}
                     </Text>
                     {/* Members list */}
                     {Array.isArray(band.members) && band.members.length > 0 && (
                       <View style={styles.membersContainer}>
                         {band.members.map((member) => (
                           <View
                             key={`${band.band_id}-${member.artist_id}`}
                             style={styles.memberChip}
                           >
                             <Text style={styles.memberChipText}>
                               {member.name}{member.role ? ` (${member.role})` : ''}
                             </Text>
                           </View>
                         ))}
                       </View>
                     )}
                   </View>
                 </TouchableOpacity>
               ))
             )}
           </View>
          {/* Social Accounts Section */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Connect Accounts</Text>
            
            {/* Active Accounts */}
            <View style={styles.accountsGroup}>
              {socialAccounts.slice(0, 2).map((account, index) => (
                <TouchableOpacity 
                  key={index}
                  style={styles.accountItem}
                  activeOpacity={0.7}
                >
                  <View style={styles.accountDetails}>
                    <View style={styles.iconBackground}>
                      <SvgXml xml={account.icon} width="24" height="24" fill="#151414" />
                    </View>
                    <View style={styles.textContainer}>
                      <Text style={styles.accountName}>{account.name}</Text>
                      <Text style={styles.accountDescription} numberOfLines={2}>{account.description}</Text>       
                    </View>
                  </View>
                  <View style={styles.connectButton}>
                     <Link href={`/Accounts` as any}>
                    <Text style={styles.connectButtonText}>Create</Text>
                     </Link>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
            
            {/* Coming Soon Accounts */}
            <View style={styles.comingSoonContainer}>
              <Text style={styles.comingsoontxt}>Coming Soon</Text>
              <View style={styles.accountsGroup}>
                {socialAccounts.slice(2).map((account, index) => (
                  <View key={index} style={styles.comingsoon}>
                    <View style={styles.accountDetails}>
                      <View style={[styles.iconBackground, styles.disabledIcon]}>
                        <SvgXml xml={account.icon} width="24" height="24" fill="#151414" />
                      </View>
                      <View style={styles.textContainer}>
                        <Text style={styles.accountName}>{account.name}</Text>
                        <Text style={styles.accountDescription} numberOfLines={1}>{account.description}</Text>       
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          </View>
          
          <View style={styles.spacer} />
        </ScrollView>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: width * 0.04,
    paddingBottom: width * 0.02,
    backgroundColor: '#f3ede6',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  headerIcon: {
    width: width * 0.12,
    height: width * 0.12,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    paddingRight: width * 0.12,
    color: '#151414',
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    paddingBottom: 24,
  },
  sectionContainer: {
    padding: width * 0.04,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#151414',
    marginBottom: 16,
  },
  // Band cards styles
  bandCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fffbf7',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  bandImageContainer: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: '#f3ede6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    overflow: 'hidden',
  },
  thumbnailImage: {
    width: 56,
    height: 56,
    borderRadius: 8,
    resizeMode: 'cover',
    backgroundColor: '#eae7e2',
  },
  bandInfoContainer: {
    flex: 1,
  },
  bandName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#151414',
    marginBottom: 4,
  },
  bandDescription: {
    fontSize: 14,
    color: '#77726E',
    marginBottom: 4,
  },
  bandCreatedDate: {
    fontSize: 12,
    color: '#b1adaa',
    marginBottom: 8,
  },
  membersContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  memberChip: {
    backgroundColor: '#f3ede6',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 8,
  },
  memberChipText: {
    color: '#77726E',
    fontSize: 12,
    fontWeight: '500',
  },
  // Loading and error states
  loadingContainer: {
    padding: 16,
    backgroundColor: '#fffbf7',
    borderRadius: 12,
    alignItems: 'center',
  },
  loadingText: {
    color: '#77726E',
    fontSize: 14,
  },
  errorContainer: {
    padding: 16,
    backgroundColor: '#fff5f5',
    borderRadius: 12,
    alignItems: 'center',
  },
  errorText: {
    color: '#dc2626',
    fontSize: 14,
    marginBottom: 12,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#fffbf7',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dc2626',
  },
  retryButtonText: {
    color: '#dc2626',
    fontSize: 14,
    fontWeight: '500',
  },
  emptyStateContainer: {
    padding: 24,
    backgroundColor: '#fffbf7',
    borderRadius: 12,
    alignItems: 'center',
  },
  emptyStateText: {
    color: '#77726E',
    fontSize: 14,
    textAlign: 'center',
  },
  // Social accounts styles
  accountsGroup: {
    marginBottom: 16,
  },
  accountItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fffbf7',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  comingSoonContainer: {
    marginTop: 24,
  },
  comingsoon: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3ede6',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    opacity: 0.6,
  },
  comingsoontxt: { 
    fontSize: 16,
    fontWeight: '500',
    color: '#888',
    marginBottom: 16,
  },
  accountDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconBackground: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#fffbf7',
    marginRight: 16,
  },
  disabledIcon: {
    backgroundColor: '#f3ede6',
    opacity: 0.7,
  },
  textContainer: {
    flex: 1,
  },
  accountName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#151414',
    marginBottom: 4,
  },
  accountDescription: {
    fontSize: 13,
    color: '#77726E',
  },
  connectButton: {
    backgroundColor: '#f3ede6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 8,
  },
  connectButtonText: {
    color: '#151414',
    fontSize: 14,
    fontWeight: '500',
  },
  spacer: {
    height: 24,
  },
});

export default LinkedAccountsScreen;