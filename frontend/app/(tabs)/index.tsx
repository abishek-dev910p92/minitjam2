 
import { Link } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Image,
  ImageBackground,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import useUserData from '../_utils/Localstorage';
import usePullToRefresh from '../_utils/usePullToRefresh';
import apiEndpoints from '../api/baseUrl';
import { httpGetJson } from '../../utils/http';

// --- TypeScript Interfaces ---
interface FeaturedBand {
  band_id: number | string;
  name: string;
  description: string;
  profile_image_url: string | null;
  created_at: string;
}

interface MusicStore {
  id: number | string;
  name: string;
  address_1: string;
  address_2?: string | null;
  phone_number: string;
  rating?: number;
}

// --- Icon Components ---
const Notification = () =>  <Svg height="24" width="24" viewBox="0 0 256 256">
    <Path 
      fill="black" 
      d="M221.8,175.94C216.25,166.38,208,139.33,208,104a80,80,0,1,0-160,0c0,35.33-8.25,62-13.8,71.94A16,16,0,0,0,48,200H88.81a40,40,0,0,0,78.38,0H208a16,16,0,0,0,13.8-24.06ZM128,224a24.07,24.07,0,0,1-23.56-16h47.12A24.07,24.07,0,0,1,128,224ZM48,184c6.23-11.41,16-43.88,16-80a64,64,0,1,1,128,0c0,36.12,9.77,68.59,16,80Z" 
    />
  </Svg>;
const GearIcon = () => <Svg height="24" width="24" viewBox="0 0 256 256"><Path fill="black" d="M128,80a48,48,0,1,0,48,48A48.05,48.05,0,0,0,128,80Zm0,80a32,32,0,1,1,32-32A32,32,0,0,1,128,160Zm88-29.84q.06-2.16,0-4.32l14.92-18.64a8,8,0,0,0,1.48-7.06,107.21,107.21,0,0,0-10.88-26.25,8,8,0,0,0-6-3.93l-23.72-2.64q-1.48-1.56-3-3L186,40.54a8,8,0,0,0-3.94-6,107.71,107.71,0,0,0-26.25-10.87,8,8,0,0,0-7.06,1.49L130.16,40Q128,40,125.84,40L107.2,25.11a8,8,0,0,0-7.06-1.48A107.6,107.6,0,0,0,73.89,34.51a8,8,0,0,0-3.93,6L67.32,64.27q-1.56,1.49-3,3L40.54,70a8,8,0,0,0-6,3.94,107.71,107.71,0,0,0-10.87,26.25,8,8,0,0,0,1.49,7.06L40,125.84Q40,128,40,130.16L25.11,148.8a8,8,0,0,0-1.48,7.06,107.21,107.21,0,0,0,10.88,26.25,8,8,0,0,0,6,3.93l23.72,2.64q1.49,1.56,3,3L70,215.46a8,8,0,0,0,3.94,6,107.71,107.71,0,0,0,26.25,10.87,8,8,0,0,0,7.06-1.49L125.84,216q2.16.06,4.32,0l18.64,14.92a8,8,0,0,0,7.06,1.48,107.21,107.21,0,0,0,26.25-10.88,8,8,0,0,0,3.93-6l2.64-23.72q1.56-1.48,3-3L215.46,186a8,8,0,0,0,6-3.94,107.71,107.71,0,0,0,10.87-26.25,8,8,0,0,0-1.49-7.06Zm-16.1-6.5a73.93,73.93,0,0,1,0,8.68,8,8,0,0,0,1.74,5.48l14.19,17.73a91.57,91.57,0,0,1-6.23,15L187,173.11a8,8,0,0,0-5.1,2.64,74.11,74.11,0,0,1-6.14,6.14,8,8,0,0,0-2.64,5.1l-2.51,22.58a91.32,91.32,0,0,1-15,6.23l-17.74-14.19a8,8,0,0,0-5-1.75h-.48a73.93,73.93,0,0,1-8.68,0,8,8,0,0,0-5.48,1.74L100.45,215.8a91.57,91.57,0,0,1-15-6.23L82.89,187a8,8,0,0,0-2.64-5.1,74.11,74.11,0,0,1-6.14-6.14,8,8,0,0,0-5.1-2.64L46.43,170.6a91.32,91.32,0,0,1-6.23-15l14.19-17.74a8,8,0,0,0,1.74-5.48,73.93,73.93,0,0,1,0-8.68,8,8,0,0,0-1.74-5.48L40.2,100.45a91.57,91.57,0,0,1,6.23-15L69,82.89a8,8,0,0,0,5.1-2.64,74.11,74.11,0,0,1,6.14-6.14A8,8,0,0,0,82.89,69L85.4,46.43a91.32,91.32,0,0,1,15-6.23l17.74,14.19a8,8,0,0,0,5.48,1.74,73.93,73.93,0,0,1,8.68,0,8,8,0,0,0,5.48-1.74L155.55,40.2a91.57,91.57,0,0,1,15,6.23L173.11,69a8,8,0,0,0,2.64,5.1,74.11,74.11,0,0,1,6.14,6.14,8,8,0,0,0,5.1,2.64l22.58,2.51a91.32,91.32,0,0,1,6.23,15l-14.19,17.74A8,8,0,0,0,199.87,123.66Z" /></Svg>;
const MusicNoteIcon = () => <Svg height="20" width="20" viewBox="0 0 256 256"><Path fill="#0e1a13" d="M210.3,56.34l-80-24A8,8,0,0,0,120,40V148.26A48,48,0,1,0,136,184V98.75l69.7,20.91A8,8,0,0,0,216,112V64A8,8,0,0,0,210.3,56.34ZM88,216a32,32,0,1,1,32-32A32,32,0,0,1,88,216ZM200,101.25l-64-19.2V50.75L200,70Z" /></Svg>;
const MagnifyingGlassIcon = () => <Svg height="24" width="24" viewBox="0 0 256 256"><Path fill="#51946b" d="M229.66,218.34l-50.07-50.06a88.11,88.11,0,1,0-11.31,11.31l50.06,50.07a8,8,0,0,0,11.32-11.32ZM40,112a72,72,0,1,1,72,72A72.08,72.08,0,0,1,40,112Z" /></Svg>;

// --- New Reusable Components for Reels and Artist Profiles ---
const ReelCard = ({ videoUrl, username }: { videoUrl: string, username: string }) => (
  <View style={styles.reelCard}>
    <ImageBackground style={styles.reelVideo} source={{ uri: videoUrl }} imageStyle={{ borderRadius: 12 }}>
      <View style={styles.reelOverlay}>
        <Text style={styles.reelUsername}>{username}</Text>
      </View>
    </ImageBackground>
  </View>
);

const ArtistProfile = ({ imageUrl, name }: { imageUrl: string, name: string }) => (
  <View style={styles.artistProfile}>
    <Image style={styles.artistImage} source={{ uri: imageUrl }} />
    <Text style={styles.artistName}>{name}</Text>
  </View>
);

// --- Reusable Components ---
// Helper to truncate text by word count
const truncateWords = (text: string, maxWords: number): string => {
  const words = String(text).trim().split(/\s+/);
  if (words.length <= maxWords) return text;
  return words.slice(0, Math.max(1, maxWords)).join(' ') + '…';
};

const formatStoreAddress = (store: MusicStore, maxWords: number = 6): string => {
  const combined = [store.address_1, store.address_2].filter(Boolean).join(', ');
  return truncateWords(combined, maxWords);
};

// Generate random gradient colors based on store name
const getRandomGradientColors = (name: string): [string, string] => {
  // Use the store name as a seed for consistent colors per store
  const seed = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  
  // Predefined gradient palettes that work well with white text
  const gradientPalettes = [
    ["#4158D0", "#C850C0"], // Purple-Pink
    ["#0093E9", "#80D0C7"], // Blue-Teal
    ["#8EC5FC", "#E0C3FC"], // Light Blue-Lavender
    ["#FF9A8B", "#FF6A88"], // Peach-Pink
    ["#FBAB7E", "#F7CE68"], // Orange-Yellow
    ["#85FFBD", "#FFFB7D"], // Green-Yellow
    ["#FF3CAC", "#784BA0"], // Pink-Purple
    ["#3B2667", "#BC78EC"], // Deep Purple-Lavender
    ["#FF7EB3", "#FF758C"], // Pink-Coral
    ["#06BEB6", "#48B1BF"]  // Teal-Blue
  ];
  
  // Select a palette based on the seed
  const paletteIndex = seed % gradientPalettes.length;
  return gradientPalettes[paletteIndex] as [string, string];
};

const CategoryTag = ({ label }: { label: string }) => (
  <View style={styles.categoryTag}>
     {/*<MusicNoteIcon />*/}
    <Text style={styles.categoryTagText}>{label}</Text>
  </View>
);

const ListItem = ({ title, subtitle, imageUrl }: { title: string, subtitle: string, imageUrl: string }) => (
  <View style={styles.listItem}>
    <Image style={styles.listItemImage} source={{ uri: imageUrl }} />
    <View>
      <Text style={styles.textPrimary}>{title}</Text>
      <Text style={styles.textSecondary}>{subtitle}</Text>
    </View>
  </View>
);

const FeaturedVenueCard = ({ id, name, genre, imageUrl, location_id, capacity }: { id?: number | string, name: string, genre: string, imageUrl: string, location_id?: number | string, capacity?: number }) => (
  <View style={styles.featuredCard}>
    <Image style={styles.featuredCardImage} source={{ uri: imageUrl }} />
    <View style={styles.featuredCardContent}>
      <View>
        <Text style={styles.textPrimary}>{name}</Text>
        <Text style={styles.textSecondary}>{genre}</Text>
        <Text style={styles.textSecondary}>Location: {String(location_id ?? '')}</Text>
        <Text style={styles.textSecondary}>Capacity: {capacity ?? '—'}</Text>
      </View>
      <Link href={`../venue_details/${id ?? ''}`} asChild >
      <TouchableOpacity style={styles.buttonSecondary}>
        <Text style={styles.buttonSecondaryText}>View</Text>
      </TouchableOpacity>
      </Link>
    </View>
  </View>
);

const BookingCard = ({ title, subtitle, imageUrl, featured=false }: { title: string, subtitle: string, imageUrl: string, featured?: boolean }) => (
    <View style={styles.bookingCard}>
        <View style={styles.bookingCardTextContainer}>
            <View>
                {featured && <Text style={styles.textSecondary}>Featured</Text>}
                <Text style={styles.textPrimaryBold}>{title}</Text>
                <Text style={styles.textSecondary}>{subtitle}</Text>
            </View>
            <TouchableOpacity style={styles.buttonSecondary}>
                <Text style={styles.buttonSecondaryText}>View All</Text>
            </TouchableOpacity>
        </View>
        <ImageBackground style={styles.bookingCardImage} imageStyle={{ borderRadius: 12 }} source={{ uri: imageUrl }} />
    </View>
);

// Store card styled like BookingCard, but links to details
const StoreCard = ({ store, featured=false }: { store: MusicStore; featured?: boolean }) => {
  // Get random gradient colors based on store name
  const gradientColors = getRandomGradientColors(String(store.name || 'store'));
  
  return (
    <View style={styles.bookingCard}>
      <View style={styles.bookingCardTextContainer}>
        <View>
          {featured && <Text style={styles.textSecondary}>Featured</Text>}
          <Text style={styles.textPrimaryBold}>{store.name}</Text>
          <Text style={styles.textSecondary} numberOfLines={1} ellipsizeMode="tail">
            {formatStoreAddress(store)}
          </Text>
          <Text style={styles.textSecondary}>Phone: {store.phone_number}</Text>
          <Text style={styles.textSecondary}>Rating: {store.rating ?? '—'}</Text>
        </View>
        <Link href={`../store_details/${store.id}`} asChild>
          <TouchableOpacity style={styles.buttonSecondary}>
            <Text style={styles.buttonSecondaryText}>View All</Text>
          </TouchableOpacity>
        </Link>
      </View>
      <ImageBackground
        style={styles.bookingCardImage}
        imageStyle={{ borderRadius: 12 }}
        source={{ uri: `https://picsum.photos/seed/${encodeURIComponent(String(store.name || 'store'))}/200` }}
      >
        <View style={styles.storeInitialOverlay}>
          <LinearGradient
            colors={gradientColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.storeInitialBadge}
          >
            <Text style={styles.storeInitialText}>
              {String(store.name || '').charAt(0).toUpperCase()}
            </Text>
          </LinearGradient>
        </View>
      </ImageBackground>
    </View>
  );
};

// Featured Band Card Component
const FeaturedBandCard = ({ band_id, name, description, profile_image_url, created_at }: FeaturedBand) => {
  // Format the creation date
  const formattedDate = new Date(created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
  
  // Get random gradient colors based on band name
  const gradientColors = getRandomGradientColors(String(name || 'band'));
  
  // Check if profile image is available
  const hasProfileImage = !!profile_image_url;
  
  return (
    <View style={styles.featuredBandCard}>
      {hasProfileImage ? (
        <Image 
          style={styles.featuredBandImage} 
          source={{ uri: profile_image_url }}
          defaultSource={require('../../assets/images/logo.png')}
        />
      ) : (
        <View style={styles.featuredBandImage}>
          <LinearGradient
            colors={gradientColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.bandInitialContainer}
          >
            <Text style={styles.bandInitialText}>
              {String(name || '').charAt(0).toUpperCase()}
            </Text>
          </LinearGradient>
        </View>
      )}
      <View style={styles.featuredBandContent}>
        <Text style={styles.textPrimaryBold}>{name}</Text>
        <Text style={styles.textSecondary} numberOfLines={2}>{description}</Text>
        <Text style={styles.textTertiary}>Since {formattedDate}</Text>
        <Link href={`../bands/band_profile_view?id=${band_id}`} asChild>
          <TouchableOpacity style={styles.buttonSecondary}>
            <Text style={styles.buttonSecondaryText}>View</Text>
          </TouchableOpacity>
        </Link>
      </View>
    </View>
  );
};

// --- Main Component ---
export default function Index() {
  // UI and refresh state
  const [refreshing, setRefreshing] = useState(false);
  const [accountPickerVisible, setAccountPickerVisible] = useState(false);
  const { user, loading } = useUserData();

  // Featured venues state
  const [featuredVenuesList, setFeaturedVenuesList] = React.useState<any[]>([]);
  const [featuredLoading, setFeaturedLoading] = React.useState(false);
  const [featuredError, setFeaturedError] = React.useState<string | null>(null);

  // Featured artists state
  const [featuredArtists, setFeaturedArtists] = React.useState<any[]>([]);
  const [featuredArtistsLoading, setFeaturedArtistsLoading] = React.useState(false);
  const [featuredArtistsError, setFeaturedArtistsError] = React.useState<string | null>(null);

  // Featured bands state
  const [featuredBands, setFeaturedBands] = React.useState<FeaturedBand[]>([]);
  const [featuredBandsLoading, setFeaturedBandsLoading] = React.useState(false);
  const [featuredBandsError, setFeaturedBandsError] = React.useState<string | null>(null);

  // Upcoming gigs state
  const [upcomingGigs, setUpcomingGigs] = useState<any[]>([]);
  const [upcomingLoading, setUpcomingLoading] = useState(false);
  const [upcomingError, setUpcomingError] = useState<string | null>(null);
  
  // Featured music stores state
  const [featuredStores, setFeaturedStores] = useState<MusicStore[]>([]);
  const [featuredStoresLoading, setFeaturedStoresLoading] = useState(false);
  const [featuredStoresError, setFeaturedStoresError] = useState<string | null>(null);
  
  // Fetch featured venues
  const fetchFeaturedVenues = async () => {
    setFeaturedLoading(true);
    setFeaturedError(null);
    try {
      const json = await httpGetJson(apiEndpoints.featuredVenues + '?limit=4', { retries: 1 });
      const items = Array.isArray(json) ? json.slice(0, 3) : (json?.items ?? []).slice(0, 3);
  setFeaturedVenuesList(items);
    } catch (e: any) {
      setFeaturedError(e?.message || 'Failed to load featured venues');
    } finally {
      setFeaturedLoading(false);
    }
  };

  // Fetch featured artists
  const fetchFeaturedArtists = async () => {
    setFeaturedArtistsLoading(true);
    setFeaturedArtistsError(null);
    try {
      const json = await httpGetJson(apiEndpoints.featuredArtists + '?limit=4', { retries: 1 });
      const items = Array.isArray(json) ? json.slice(0, 4) : (json?.items ?? []).slice(0, 4);
      setFeaturedArtists(items);
    } catch (e: any) {
      setFeaturedArtistsError(e?.message || 'Failed to load featured artists');
    } finally {
      setFeaturedArtistsLoading(false);
    }
  };

  // Fetch featured bands
  const fetchFeaturedBands = async () => {
    setFeaturedBandsLoading(true);
    setFeaturedBandsError(null);
    try {
      const json = await httpGetJson(`${apiEndpoints.bands}/featured`, { retries: 1 });
      const items = Array.isArray(json) ? json.slice(0, 4) : (json?.items ?? []).slice(0, 4);
      setFeaturedBands(items);
    } catch (e: any) {
      setFeaturedBandsError(e?.message || 'Failed to load featured bands');
    } finally {
      setFeaturedBandsLoading(false);
    }
  };

  // Fetch upcoming gigs
  const fetchUpcomingGigs = async () => {
    if (loading) return;
    setUpcomingLoading(true);
    setUpcomingError(null);
    try {
      const artistId = (user as any)?.artist_id ?? (user as any)?.id ?? 45;
      const baseApi = apiEndpoints.featuredVenues.replace('venues/featured', '');
      const url = `${baseApi}artists/${artistId}/gigs?page=1&per_page=10`;
      const json = await httpGetJson(url, { retries: 1 });
      const items = Array.isArray(json) ? json : (json?.items ?? []);
      setUpcomingGigs(items);
    } catch (e: any) {
      setUpcomingError(e?.message || 'Failed to load upcoming gigs');
    } finally {
      setUpcomingLoading(false);
    }
  };

  // Hooked pull to refresh
  const { refreshControl } = usePullToRefresh({
    onRefresh: async () => {
      await Promise.all([
        fetchFeaturedVenues(),
        fetchFeaturedArtists(),
        fetchFeaturedBands(),
        fetchUpcomingGigs(),
        fetchFeaturedStores(),
      ]);
    },
  });

  useEffect(() => {
    // Fetch upcoming gigs for the current user (artist)
    let cancelled = false;
    const controller = new AbortController();
    const fetchUpcoming = async () => {
      setUpcomingLoading(true);
      setUpcomingError(null);
      try {
        // Try to determine artist id from user object, fallback to 45 if not available
        const artistId = (user as any)?.artist_id ?? (user as any)?.id ?? 45;
        // Construct artists/{id}/gigs endpoint using an existing endpoint as base
        const baseApi = apiEndpoints.featuredVenues.replace('venues/featured', '');
        const url = `${baseApi}artists/${artistId}/gigs?page=1&per_page=10`;
        const json = await httpGetJson(url, { signal: controller.signal, retries: 1 });
        const items = Array.isArray(json) ? json : (json?.items ?? []);
        if (!cancelled) setUpcomingGigs(items);
      } catch (e: any) {
        if (e?.name === 'AbortError') return;
        setUpcomingError(e?.message || 'Failed to load upcoming gigs');
      } finally {
        if (!cancelled) setUpcomingLoading(false);
      }
    };
    // Only fetch after user is loaded (or immediately if user is null)
    if (!loading) fetchUpcoming();
    return () => { cancelled = true; controller.abort(); };
  }, [user, loading]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const fetchFeatured = async () => {
      setFeaturedLoading(true);
      setFeaturedError(null);
      try {
        const json = await httpGetJson(apiEndpoints.featuredVenues + '?limit=4', { signal: controller.signal, retries: 1 });
        const items = Array.isArray(json) ? json.slice(0, 3) : (json?.items ?? []).slice(0, 3);
  if (!cancelled) setFeaturedVenuesList(items);
      } catch (e: any) {
        if (e?.name === 'AbortError') return;
        setFeaturedError(e?.message || 'Failed to load featured venues');
      } finally {
        if (!cancelled) setFeaturedLoading(false);
      }
    };
    fetchFeatured();
    return () => { cancelled = true; controller.abort(); };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const fetchArtists = async () => {
      setFeaturedArtistsLoading(true);
      setFeaturedArtistsError(null);
      try {
        const json = await httpGetJson(apiEndpoints.featuredArtists + '?limit=4', { signal: controller.signal, retries: 1 });
        const items = Array.isArray(json) ? json.slice(0, 4) : (json?.items ?? []).slice(0, 4);
        if (!cancelled) setFeaturedArtists(items);
      } catch (e: any) {
        if (e?.name === 'AbortError') return;
        setFeaturedArtistsError(e?.message || 'Failed to load featured artists');
      } finally {
        if (!cancelled) setFeaturedArtistsLoading(false);
      }
    };
    fetchArtists();
    return () => { cancelled = true; controller.abort(); };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const fetchBands = async () => {
      setFeaturedBandsLoading(true);
      setFeaturedBandsError(null);
      try {
        const json = await httpGetJson(`${apiEndpoints.bands}/featured`, { signal: controller.signal, retries: 1 });
        const items = Array.isArray(json) ? json.slice(0, 4) : (json?.items ?? []).slice(0, 4);
        if (!cancelled) setFeaturedBands(items);
      } catch (e: any) {
        if (e?.name === 'AbortError') return;
        setFeaturedBandsError(e?.message || 'Failed to load featured bands');
      } finally {
        if (!cancelled) setFeaturedBandsLoading(false);
      }
    };
    fetchBands();
    return () => { cancelled = true; controller.abort(); };
  }, []);

  // Fetch featured stores
  const fetchFeaturedStores = async (limit: number = 10) => {
    const validated = Math.max(1, Math.min(Number(limit) || 10, 50));
    setFeaturedStoresLoading(true); 
    setFeaturedStoresError(null);
    try {
      const json = await httpGetJson(`${apiEndpoints.musicStoresFeatured}?limit=${validated}`, { retries: 1 });
      const items: MusicStore[] = Array.isArray(json)
        ? (json as any[]).slice(0, validated) as MusicStore[]
        : ((json?.stores ?? []) as MusicStore[]).slice(0, validated);
      // Ensure sorting by rating desc then name asc (fallback client-side)
      items.sort((a: MusicStore, b: MusicStore) => {
        const rdiff = (b.rating ?? 0) - (a.rating ?? 0);
        if (rdiff !== 0) return rdiff;
        return String(a.name).localeCompare(String(b.name));
      });
      setFeaturedStores(items);
    } catch (e: any) {
      setFeaturedStoresError(e?.message || 'Failed to load featured music stores');
    } finally {
      setFeaturedStoresLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const fetchStores = async () => {
      setFeaturedStoresLoading(true);
      setFeaturedStoresError(null);
      try {
        const json = await httpGetJson(`${apiEndpoints.musicStoresFeatured}?limit=10`, { signal: controller.signal, retries: 1 });
        const items: MusicStore[] = Array.isArray(json)
          ? (json as any[]).slice(0, 10)
          : ((json?.stores ?? []) as MusicStore[]).slice(0, 10);
        items.sort((a, b) => {
          const rdiff = (b.rating ?? 0) - (a.rating ?? 0);
          if (rdiff !== 0) return rdiff;
          return String(a.name).localeCompare(String(b.name));
        });
        if (!cancelled) setFeaturedStores(items);
      } catch (e: any) {
        if (e?.name === 'AbortError') return;
        setFeaturedStoresError(e?.message || 'Failed to load featured music stores');
      } finally {
        if (!cancelled) setFeaturedStoresLoading(false);
      }
    };
    fetchStores();
    return () => { cancelled = true; controller.abort(); };
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <Image source={require('../../assets/images/bg header.png')} className='z-0 w-full absolute' />
      <ScrollView
        refreshControl={refreshControl}
      >
        {/* Header */}
        <View style={styles.header}>
           <View style={{ flex: 1 }}>
            <TouchableOpacity style={styles.dropdownButton} onPress={() => setAccountPickerVisible(true)}>
              <Text style={styles.dropdownButtonText}>{(user as any)?.name || 'Guest'}</Text>
              <Text style={styles.dropdownCaret}>▼</Text>
            </TouchableOpacity>
          </View>
          <Link href={'../notifications'} asChild>
          <TouchableOpacity style={styles.headerIcon}>
           {/* <GearIcon /> */}
              <Notification />
          </TouchableOpacity>
          </Link>
        </View>
        
        {/* Account Switcher Modal */}
        {/* <Modal
          transparent
          visible={accountPickerVisible}
          animationType="fade"
          onRequestClose={() => setAccountPickerVisible(false)}
        >
          <View style={styles.modalRoot}>
           <Pressable style={styles.modalBackdrop} onPress={() => setAccountPickerVisible(false)} />
             <View style={styles.modalContent}>
              {accountOptions.map((opt) => (
                <TouchableOpacity
                  key={opt}
                  style={styles.dropdownItem}
                  onPress={() => {
                    setSelectedAccount(opt);
                    setAccountPickerVisible(false);
                  }}
                >
                  <Text style={styles.dropdownItemText}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Modal> */}
        
        {/* Category Tags */} 
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScroll}>
            {
              // helper to map tag to search tab
            }
            {(() => {
              const tags = ["Solo", "Dancers", "DJ's", "Sound Engineers", "Services", "Rentals"];
              const mapTagToTab = (t: string) => {
                const key = t.toLowerCase();
                const artistTags = ['solo', 'dancers', "dj", "dj", 'djs'];
                const gigsTags: string[] = ['gig', 'gigs', 'event', 'events'];
                const serviceTags = ['sound', 'engineer', 'engineers', 'service', 'services', 'rental', 'rentals'];
                if (artistTags.some(a => key.includes(a))) return 'Artists';
                if (gigsTags.some(g => key.includes(g))) return 'Events';
                if (serviceTags.some(s => key.includes(s))) return 'Services';
                return 'Artists'; // default to Artists
              };

              return tags.map((label, idx) => {
                const tab = mapTagToTab(label);
                const href = { pathname: '/search', params: { q: label, tab } } as any;
                return (
                  <Link key={`tag-${idx}`} href={href} asChild>
                    <TouchableOpacity>
                      <CategoryTag label={label} />
                    </TouchableOpacity>
                  </Link>
                );
              });
            })()}
        </ScrollView>
        
 {/* Search Input */}
        <View style={styles.searchSection}>
          
            <View style={styles.searchInputContainer}>
                <View style={styles.searchIcon}>
                    <MagnifyingGlassIcon />
                </View>
                <Link href={'../search'} asChild>
                <TextInput
                    placeholder="Search venues or artists"
                    placeholderTextColor="#16120f"
                    style={styles.input}
                /></Link>
            </View>
            
        </View>

        {/* Upgrade Card */}
        <View style={styles.cardContainer}>
          <View style={styles.upgradeCard}>
            <Image style={styles.upgradeCardImage} source={require('../../assets/images/minit jam.png')} />
            <View style={styles.upgradeCardContent}>
              <Text style={styles.textLgBold}>Stop searching, start performing</Text>
              <Text style={styles.textSecondary}>Unlock your direct line to the city&apos;s best venues.</Text>
            </View>
          </View>
        </View>
        
       
        
        {/* Upcoming Gigs */}
        <Text style={styles.sectionTitle}>Upcoming Gigs</Text>
        {upcomingLoading ? (
          <Text style={[styles.textSecondary, {marginLeft:20}]}>Loading upcoming gigs...</Text>
        ) : upcomingError ? (
          <Text style={styles.textSecondary}>{upcomingError}</Text>
        ) : upcomingGigs.length === 0 ? (
          <Text style={[styles.textSecondary, {marginLeft: 25 }]}>No upcoming gigs.</Text>
        ) : (
          upcomingGigs.map((g: any) => (
            <ListItem
              key={g.booking_id ?? g.id ?? `${g.club_id}-${g.event_date}`}
              title={new Date(g.event_date).toLocaleString()}
              subtitle={g.venue_name || g.venue || 'Unknown venue'}
              imageUrl={g.venue_image_url || 'https://picsum.photos/seed/gig/100'}
            />
          ))
        )} 

        {/* All Venues
        <Text style={styles.sectionTitle}>Find Venues</Text>
        <ListItem title="The Stage Door" subtitle="Downtown" imageUrl="https://picsum.photos/seed/venue1/100" />
        <ListItem title="The Groove Room" subtitle="Uptown" imageUrl="https://picsum.photos/seed/venue2/100" />
        <ListItem title="The Acoustic Lounge" subtitle="Midtown" imageUrl="https://picsum.photos/seed/venue3/100" />
        <View style={styles.viewAllButtonContainer}>
            <TouchableOpacity style={styles.buttonPrimary}>
                <Text style={styles.buttonPrimaryText}>View All</Text>
            </TouchableOpacity> 
        </View> */}

        
        {/* Featured Venues */}
        <Text style={styles.sectionTitle}>Featured Venues</Text>
         <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScroll}>
            {featuredLoading ? (
              <Text style={styles.textSecondary}>Loading featured venues...</Text>
            ) : featuredError ? (
              <Text style={styles.textSecondary}>{featuredError}</Text>
            ) : featuredVenuesList.length === 0 ? (
              <Text style={styles.textSecondary}>No featured venues found.</Text>
            ) : (
              featuredVenuesList.map((v: any, idx: number) => (
                <FeaturedVenueCard
                  key={v.club_id ?? v.id ?? idx}
                  id={v.club_id ?? v.id ?? v.location_id ?? idx}
                  name={v.name}
                  genre={String(v.location_id ?? '')}
                  imageUrl={v.profile_image_url || 'https://picsum.photos/seed/featured/200'}
                  location_id={v.location_id}
                  capacity={v.capacity}
                />
              ))
            )}
        </ScrollView>

        {/* Reels Section */}
         {/*
        <Text style={styles.sectionTitle}>Moments</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScroll}>
            <ReelCard videoUrl="https://picsum.photos/seed/reel1/200/300" username="@artist1" />
            <ReelCard videoUrl="https://picsum.photos/seed/reel2/200/300" username="@artist2" />
            <ReelCard videoUrl="https://picsum.photos/seed/reel3/200/300" username="@artist3" />
            <ReelCard videoUrl="https://picsum.photos/seed/reel4/200/300" username="@artist4" />
        </ScrollView>*/}

        {/* Artist Profiles Section */}
        <Text style={styles.sectionTitle}>Featured Artists</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScroll}>
          {featuredArtistsLoading ? (
            <Text style={styles.textSecondary}>Loading featured artists...</Text>
          ) : featuredArtistsError ? (
            <Text style={styles.textSecondary}>{featuredArtistsError}</Text>
          ) : featuredArtists.length === 0 ? (
            <Text style={styles.textSecondary}>No featured artists found.</Text>
          ) : (
            featuredArtists.map((a, idx) => (
              <Link key={a.artist_id ?? idx} href={`../artist_details/${a.artist_id ?? ''}`} asChild>
                <TouchableOpacity>
                  <ArtistProfile imageUrl={a.profile_image_url || 'https://picsum.photos/seed/artist/100'} name={a.name} />
                </TouchableOpacity>
              </Link>
            ))
          )}
        </ScrollView>
        
        {/* Featured Bands */}
        <Text style={styles.sectionTitle}>Featured Bands</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScroll}>
          {featuredBandsLoading ? (
            <Text style={styles.textSecondary}>Loading featured bands...</Text>
          ) : featuredBandsError ? (
            <Text style={styles.textSecondary}>{featuredBandsError}</Text>
          ) : featuredBands.length === 0 ? (
            <Text style={styles.textSecondary}>No featured bands found.</Text>
          ) : (
            featuredBands.map((band) => (
              <FeaturedBandCard
                key={band.band_id}
                band_id={band.band_id}
                name={band.name}
                description={band.description}
                profile_image_url={band.profile_image_url}
                created_at={band.created_at}
              />
            ))
          )}
        </ScrollView>
        
        {/* Featured Music Stores */}
        <Text style={styles.sectionTitle}>Featured Stores & Jam Rooms</Text>
        {featuredStoresLoading ? (
          <Text style={styles.textSecondary}>Loading featured stores...</Text>
        ) : featuredStoresError ? (
          <Text style={styles.textSecondary}>{featuredStoresError}</Text>
        ) : featuredStores.length === 0 ? (
          <Text style={styles.textSecondary}>No featured music stores found.</Text>
        ) : (
          featuredStores.slice(0, 3).map((s, idx) => (
            <StoreCard key={String(s.id)} store={s} featured={idx === 0} />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// --- Stylesheet ---
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  featuredBandCard: {
    width: 225,
    marginRight: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  featuredBandImage: {
    width: '100%',
    height: 140,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  featuredBandContent: {
    padding: 12,
  },
  textTertiary: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    paddingBottom: 8,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'left',
    color: '#16120f',
    fontSize: 18,
    fontWeight: 'bold',
    paddingLeft: 3,
  },
  headerIcon: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    height: 40,
    paddingHorizontal: 12,
     
    borderRadius: 12,
  },
  dropdownButtonText: {
    color: '#16120f',
    fontSize: 16,
    fontWeight: 'bold',
  },
  dropdownCaret: {
    marginLeft: 8,
    color: '#51946b',
    fontSize: 12,
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  modalContent: {
    backgroundColor: '#fffbf7',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  dropdownItem: {
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomColor: '#eaeaea',
    borderBottomWidth: 1,
  },
  dropdownItemText: {
    color: '#16120f',
    fontSize: 16,
  },
  horizontalScroll: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 12,
  },
  categoryTag: {
    flexDirection: 'row',
    height: 32,
    backgroundColor: '#fffbf7',
    borderRadius: 12,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  categoryTagText: {
    color: '#16120f',
    fontSize: 14,
    fontWeight: '500',
  },
  cardContainer: {
    padding: 16,
  },
  upgradeCard: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  upgradeCardImage: {
    resizeMode: 'cover',
    height: 225,
    aspectRatio: 16 / 9,
  },
  upgradeCardContent: {
      padding: 16,
      gap: 4,
  },
  searchSection: {
    paddingHorizontal: 16,
    paddingVertical: 35,
  },
  searchInputContainer: {
    flexDirection: 'row',
    height: 48,
    width: '100%',
    backgroundColor: '#fffbf7',
    borderRadius: 12,
    alignItems: 'stretch',
  },
  searchIcon: {
    paddingLeft: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    paddingHorizontal: 8,
    color: '#16120f',
    fontSize: 16,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#16120f',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 12,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 16,
    minHeight: 72,
    paddingVertical: 8,
  },
  listItemImage: {
    width: 56,
    height: 56,
    borderRadius: 8,
  },
  viewAllButtonContainer: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      paddingHorizontal: 16,
      paddingVertical: 12,
  },
  buttonPrimary: {
    height: 40,
    backgroundColor: '#16120f',
    borderRadius: 12,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  buttonPrimaryText: {
    color: '#fffbf7',
    fontSize: 14,
    fontWeight: 'bold',
  },
  featuredCard: {
    width: 200,
    height: 'auto',
    borderRadius: 12,
    backgroundColor: '#fffbf7',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 2,
  },
  featuredCardImage: {
    width: '100%',
    aspectRatio: 1,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  featuredCardContent: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between',
    gap: 16,
  },
  buttonSecondary: {
    height: 32,
    backgroundColor: '#16120f',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  buttonSecondaryText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  bookingCard: {
    flexDirection: 'row',
    gap: 16,
    padding: 16,
  },
  bookingCardTextContainer: {
    flex: 2,
    justifyContent: 'space-between',
  },
  bookingCardImage: {
    flex: 1,
    aspectRatio: 1,
  },
  storeInitialOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  storeInitialBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  storeInitialText: {
    color: '#fff',
  },
  bandInitialContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  bandInitialText: {
    color: '#fff',
    fontSize: 48,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  textPrimary: {
    color: '#16120f',
    fontSize: 16,
    fontWeight: '500',
  },
  textPrimaryBold: {
    color: '#16120f',
    fontSize: 16,
    fontWeight: 'bold',
  },
  textSecondary: {
    color: '#51946b',
    fontSize: 14,
     
  },
  textLgBold: {
    color: '#16120f',
    fontSize: 18,
    fontWeight: 'bold',
  },
  reelCard: {
    width: 150,
    height: 250,
    borderRadius: 12,
    overflow: 'hidden',
  },
  reelVideo: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  reelOverlay: {
    padding: 8,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  reelUsername: {
    color: 'white',
    fontWeight: 'bold',
  },
  artistProfile: {
    alignItems: 'center',
    gap: 8,
  },
  artistImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  artistName: {
    color: '#16120f',
    fontWeight: '500',
  },
});