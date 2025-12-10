import { Link, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  Image,
  ImageBackground,
  Linking,
  Modal,
  // SafeAreaView,  // moved to react-native-safe-area-context
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import apiEndpoints from '../api/baseUrl';
import { httpGetJson } from '../../utils/http';

// Types from API responses
interface Artist {
  artist_id: number;
  name: string;
  genre_id: number;
  location_id: number;
  profile_image_url?: string | null;
  created_at: string;
}

interface Opportunity {
  opportunity_id: number;
  club_id: number;
  title: string;
  description?: string | null;
  event_date: string;
  event_time: string;
  status: string;
}

interface Venue {
  club_id: number;
  name: string;
  location_id?: number | string;
  capacity?: number | null;
  profile_image_url?: string | null;
  created_at: string;
}

interface BandItem {
  band_id: number;
  name: string;
  description?: string | null;
  profile_image_url?: string | null;
  created_by?: number;
  members?: any[];
} 

// Music Store interface
interface MusicStore {
  id: number;
  name: string;
  address_1?: string;
  address_2?: string;
  phone_number?: string;
  rating?: number | string;
}

const { width } = Dimensions.get('window');

// --- Color Palette ---
const Colors = {
  background: '#f6f5f4', // Neutral 50 equivalent
  primary: '#151414',
  backButton:'white',
  secondary: '#77726e',
  inputBg: '#eeedec',
  borderColor: '#dddbda',
  activeTabBorder: '#6b6057',
};

const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// --- Icon Components ---
const ArrowLeftIcon = () => (
  <Svg height="24" width="24" viewBox="0 0 256 256">
    <Path
      fill={Colors.backButton}
      d="M224,128a8,8,0,0,1-8,8H59.31l58.35,58.34a8,8,0,0,1-11.32,11.32l-72-72a8,8,0,0,1,0-11.32l72-72a8,8,0,0,1,11.32,11.32L59.31,120H216A8,8,0,0,1,224,128Z"
    />
  </Svg>
);

const MagnifyingGlassIcon = () => (
  <Svg height="24" width="24" viewBox="0 0 256 256">
    <Path
      fill={Colors.secondary}
      d="M229.66,218.34l-50.07-50.06a88.11,88.11,0,1,0-11.31,11.31l50.06,50.07a8,8,0,0,0,11.32-11.32ZM40,112a72,72,0,1,1,72,72A72.08,72.08,0,0,1,40,112Z"
    />
  </Svg>
);

const CaretDownIcon = () => (
  <Svg height="20" width="20" viewBox="0 0 256 256">
    <Path
      fill={Colors.primary}
      d="M213.66,101.66l-80,80a8,8,0,0,1-11.32,0l-80-80A8,8,0,0,1,53.66,90.34L128,164.69l74.34-74.35a8,8,0,0,1,11.32,11.32Z"
    />
  </Svg>
);

const formatText = (value: any, fallback: string = ''): string => {
  const s = typeof value === 'string' ? value.trim() : '';
  if (!s) return fallback;
  if (s.toLowerCase() === 'null') return fallback;
  return s;
};

const formatCapacity = (capacity?: number | null): string => {
  if (capacity === null || capacity === undefined) return 'Capacity not specified';
  const n = Number(capacity);
  if (!Number.isFinite(n)) return 'Capacity not specified';
  return `${new Intl.NumberFormat('en-US').format(n)} capacity`;
};

// --- Dummy Data ---
// Removed venueData dummy array; using live Featured Venues API instead

const artistData: Artist[] = [];

const eventsData: { name: string; location: string; imageUrl: string }[] = [];

const servicesData = [
  { name: 'Sound & Lighting', location: 'Metropolis', imageUrl: 'https://picsum.photos/seed/service1/200' },
  { name: 'Catering', location: 'All areas', imageUrl: 'https://picsum.photos/seed/service2/200' },
];

const locationOptions = ['Metropolis', 'Gotham', 'Star City', 'Central City'];
const venueTypeOptions = ['Club', 'Bar', 'Stadium', 'Theater'];
const capacityOptions = ['50-100', '100-250', '250+'];
const filterButtons = ['Dates', 'Location', 'Capacity'];

// --- Reusable Components ---
const FilterButton = ({ label, onPress }: { label: string; onPress: () => void }) => (
  <TouchableOpacity style={styles.filterButton} onPress={onPress}>
    <Text style={styles.filterButtonText}>{label}</Text>
    <CaretDownIcon />
  </TouchableOpacity>
);

const VenueListItem = React.memo(({ name, location, capacity, imageUrl }: { name: string; location?: string | number; capacity?: number | null; imageUrl: string }) => (
  <View style={styles.listItemContainer}>
    <View style={styles.listItemTextContainer}>
      <Text style={styles.textSecondary}>Venue</Text>
      <Text style={styles.textPrimary}>{formatText(name, 'Unnamed venue')}</Text>
      <Text style={styles.textSecondary}>{typeof location === 'string' ? formatText(location, 'Location not specified') : 'Location not specified'}, {formatCapacity(capacity)}</Text>
    </View>
    <Image style={styles.venueImage} source={{ uri: imageUrl }} />
  </View>
));
VenueListItem.displayName = 'VenueListItem';

const ArtistListItem = React.memo(({ name, location, imageUrl }: { name: string; location?: string | number; imageUrl: string }) => (
  <View style={styles.listItemContainer}>
    <View style={styles.listItemTextContainer}>
      <Text style={styles.textSecondary}>Artist</Text>
      <Text style={styles.textPrimary}>{formatText(name, 'Unnamed artist')}</Text>
      <Text style={styles.textSecondary}>{typeof location === 'string' ? formatText(location, 'Location not specified') : 'Location not specified'}</Text>
    </View>
    <Image style={styles.venueImage} source={{ uri: imageUrl }} />
  </View>
));
ArtistListItem.displayName = 'ArtistListItem';

const EventListItem = ({ name, location, imageUrl }: { name: string; location: string; imageUrl: string }) => (
  <View style={styles.listItemContainer}>
    <View style={styles.listItemTextContainer}>
      <Text style={styles.textSecondary}>Event</Text>
      <Text style={styles.textPrimary}>{name}</Text>
      <Text style={styles.textSecondary}>{location}</Text>
    </View>
    <Image style={styles.venueImage} source={{ uri: imageUrl }} />
  </View>
);

const BandListItem = React.memo(({ band }: { band: BandItem }) => (
  <Link key={String(band.band_id)} href={{ pathname: '/bands/band_profile_view', params: { id: String(band.band_id) } }} asChild>
    <TouchableOpacity>
      <View style={styles.listItemContainer}>
        <View style={styles.listItemTextContainer}>
          <Text style={styles.textSecondary}>Band</Text>
          <Text style={styles.textPrimary}>{formatText(band.name, 'Unnamed band')}</Text>
          <Text style={styles.textSecondary}>{formatText(band.description, 'No description provided')}</Text>
        </View>
        <Image style={styles.venueImage} source={{ uri: band.profile_image_url || 'https://picsum.photos/seed/band/400/300' }} />
      </View>
    </TouchableOpacity>
  </Link>
));
BandListItem.displayName = 'BandListItem';

const OpportunityListItem = ({ opportunity_id, title, description, event_date, event_time }: { opportunity_id: number; title: string; description?: string | null; event_date: string; event_time: string }) => (
  <Link href={{ pathname: '/gig_details/[id]', params: { id: String(opportunity_id) } }} asChild>
    <TouchableOpacity>
      <View style={styles.listItemContainer}>
        <View style={styles.listItemTextContainer}>
          <Text style={styles.textSecondary}>Gig</Text>
          <Text style={styles.textPrimary}>{formatText(title, 'Untitled')}</Text>
          <Text style={styles.textSecondary}>{formatText(description, 'No description provided')}</Text>
          <Text style={styles.textSecondary}>{event_date} • {event_time}</Text>
        </View>
      </View>
    </TouchableOpacity>
  </Link>
);

const ServiceListItem = ({ name, location, imageUrl }: { name: string; location: string; imageUrl: string }) => (
  <View style={styles.listItemContainer}>
    <View style={styles.listItemTextContainer}>
      <Text style={styles.textSecondary}>Service</Text>
      <Text style={styles.textPrimary}>{name}</Text>
      <Text style={styles.textSecondary}>{location}</Text>
    </View>
    <Image style={styles.venueImage} source={{ uri: imageUrl }} />
  </View>
);

// Music Store List Item
const StoreListItem = ({ store }: { store: MusicStore }) => {
  const initial = (store?.name?.[0] || '?').toUpperCase();
  const idStr = String(store.id);
  return (
    <View style={styles.listItemContainer}>
      <View >
        <Text>{initial}</Text>
      </View>
      <View style={[styles.listItemTextContainer, { flex: 3 }]}>        
        <Text style={styles.textPrimary}>{store.name}</Text>
        {!!store.address_1 && <Text style={styles.textSecondary}>{store.address_1}</Text>}
        {!!store.address_2 && <Text style={styles.textSecondary}>{store.address_2}</Text>}
        <View>
          <TouchableOpacity  onPress={() => { if (store.phone_number) Linking.openURL(`tel:${store.phone_number}`); }}>
            <Text>📞 Call</Text>
          </TouchableOpacity>
          {store.rating !== undefined && (
            <Text style={styles.textSecondary}>Rating {String(store.rating)}</Text>
          )}
        </View>
      </View>
      <Link href={{ pathname: '/store_details/[id]', params: { id: idStr } }} asChild>
        <TouchableOpacity  >
          <Text>Details</Text>
        </TouchableOpacity>
      </Link>
    </View>
  );
};


// --- Main Search Screen Component ---
export default function SearchScreen() {
  const params = useLocalSearchParams();
  const initialQ = typeof params?.q === 'string' ? params.q : '';
  const initialTab = typeof params?.tab === 'string' ? params.tab : 'Venues';
  const [activeTab, setActiveTab] = useState(initialTab || 'Venues');
  const [isLocationModalVisible, setLocationModalVisible] = useState(false);
  const [isDateModalVisible, setDateModalVisible] = useState(false);
  const [isCapacityModalVisible, setCapacityModalVisible] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null); // ISO date YYYY-MM-DD

  // Search state with debouncing
  const [query, setQuery] = useState(initialQ ?? '');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const userTypedRef = useRef(false);

  // Artists state
  const [artists, setArtists] = useState<Artist[]>([]);
  const artistsPageRef = useRef(1);
  const artistsLimitRef = useRef(20);
  const [artistsLoading, setArtistsLoading] = useState(false);
  const [artistsError, setArtistsError] = useState<string | null>(null);
  
  // Opportunities (Gigs) state
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const opportunitiesPageRef = useRef(1);
  const opportunitiesLimitRef = useRef(20);
  const [opportunitiesLoading, setOpportunitiesLoading] = useState(false);
  const [opportunitiesError, setOpportunitiesError] = useState<string | null>(null);

  // Music stores state
  const [stores, setStores] = useState<MusicStore[]>([]);
  const [storesLoading, setStoresLoading] = useState(false);
  const [storesError, setStoresError] = useState<string | null>(null);
  const storesAbortRef = useRef<AbortController | null>(null);
  const opportunitiesHasMoreRef = useRef(true);
  const opportunitiesAbortRef = useRef<AbortController | null>(null);
  const artistsHasMoreRef = useRef(true);
  const artistAbortRef = useRef<AbortController | null>(null);

  // Venues state
  const [venues, setVenues] = useState<Venue[]>([]);
  const venuesPageRef = useRef(1);
  const venuesLimitRef = useRef(20);
  const [venuesLoading, setVenuesLoading] = useState(false);
  const [venuesError, setVenuesError] = useState<string | null>(null);
  const venuesHasMoreRef = useRef(true);
  const venueAbortRef = useRef<AbortController | null>(null);

  // Bands state (search)
  const [bands, setBands] = useState<BandItem[]>([]);
  const bandsPageRef = useRef(1);
  const bandsLimitRef = useRef(20);
  const [bandsLoading, setBandsLoading] = useState(false);
  const [bandsError, setBandsError] = useState<string | null>(null);
  const bandsHasMoreRef = useRef(true);
  const bandsAbortRef = useRef<AbortController | null>(null);

  // Featured Venues state
  const [featuredVenues, setFeaturedVenues] = useState<Venue[]>([]);
  const [featuredLoading, setFeaturedLoading] = useState(false);
  const [featuredError, setFeaturedError] = useState<string | null>(null);
  const featuredAbortRef = useRef<AbortController | null>(null);

  // Featured Artists preview
  const [featuredArtists, setFeaturedArtists] = useState<Artist[]>([]);
  const [featuredArtistsLoading, setFeaturedArtistsLoading] = useState(false);
  const [featuredArtistsError, setFeaturedArtistsError] = useState<string | null>(null);
  const featuredArtistsAbortRef = useRef<AbortController | null>(null);

  // Preview opportunities (recent gigs)
  const [previewOpportunities, setPreviewOpportunities] = useState<Opportunity[]>([]);
  const [previewOpportunitiesLoading, setPreviewOpportunitiesLoading] = useState(false);
  const [previewOpportunitiesError, setPreviewOpportunitiesError] = useState<string | null>(null);
  const previewOppAbortRef = useRef<AbortController | null>(null);

  // Debounce effect
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(handler);
  }, [query]);

  // Helpers
  const clampLimit = useCallback((v: number) => Math.min(Math.max(1, v || 20), 50), []);

  const buildUrl = (base: string, q: string, page: number, limit: number) => {
    const params = new URLSearchParams();
    params.set('q', q);
    params.set('page', String(page));
    params.set('limit', String(limit));
    return `${base}?${params.toString()}`;
  };

  const parsePaginated = <T,>(json: any, currentPage: number, currentLimit: number): { items: T[]; page: number; limit: number } => {
    const items: T[] = Array.isArray(json) ? json : (json?.data ?? json?.items ?? json?.results ?? []);
    const page = Number(json?.page ?? json?.meta?.page ?? currentPage) || currentPage;
    const limit = Number(json?.limit ?? json?.meta?.limit ?? currentLimit) || currentLimit;
    return { items, page, limit };
  };

  const fetchArtists = useCallback(async (opts?: { reset?: boolean }) => {
    if (!debouncedQuery) return;
    const reset = !!opts?.reset;
    if (artistsLoading) return;

    setArtistsLoading(true);
    setArtistsError(null);

    try {
      // Abort any in-flight request
      if (artistAbortRef.current) {
        artistAbortRef.current.abort();
      }
      const controller = new AbortController();
      artistAbortRef.current = controller;

      const page = reset ? 1 : artistsPageRef.current;
      const limit = clampLimit(artistsLimitRef.current);
      const url = buildUrl(apiEndpoints.artistSearch, debouncedQuery, page, limit);

      const json = await httpGetJson(url, { signal: controller.signal, retries: 1 });
      const { items, page: respPage, limit: respLimit } = parsePaginated<Artist>(json, page, limit);

      artistsLimitRef.current = clampLimit(respLimit || limit);
      artistsPageRef.current = (reset ? 1 : page) + 1; // next page for subsequent loads
      artistsHasMoreRef.current = (items?.length ?? 0) >= clampLimit(artistsLimitRef.current);

      setArtists(prev => (reset ? items : [...prev, ...items]));
    } catch (e: any) {
      if (e?.name === 'AbortError') return; // ignore
      setArtistsError(e?.message || 'Failed to load artists');
    } finally {
      setArtistsLoading(false);
    }
  }, [debouncedQuery, artistsLoading, clampLimit]);

  const fetchVenues = useCallback(async (opts?: { reset?: boolean }) => {
    if (!debouncedQuery) return;
    const reset = !!opts?.reset;
    if (venuesLoading) return;

    setVenuesLoading(true);
    setVenuesError(null);

    try {
      if (venueAbortRef.current) {
        venueAbortRef.current.abort();
      }
      const controller = new AbortController();
      venueAbortRef.current = controller;

      const page = reset ? 1 : venuesPageRef.current;
      const limit = clampLimit(venuesLimitRef.current);
      const url = buildUrl(apiEndpoints.venueSearch, debouncedQuery, page, limit);

      const json = await httpGetJson(url, { signal: controller.signal, retries: 1 });
      const { items, page: respPage, limit: respLimit } = parsePaginated<Venue>(json, page, limit);

      venuesLimitRef.current = clampLimit(respLimit || limit);
      venuesPageRef.current = (reset ? 1 : page) + 1;
      venuesHasMoreRef.current = (items?.length ?? 0) >= clampLimit(venuesLimitRef.current);

      setVenues(prev => (reset ? items : [...prev, ...items]));
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
      setVenuesError(e?.message || 'Failed to load venues');
    } finally {
      setVenuesLoading(false);
    }
  }, [debouncedQuery, venuesLoading, clampLimit]);

  const fetchBands = useCallback(async (opts?: { reset?: boolean }) => {
    if (!debouncedQuery) return;
    const reset = !!opts?.reset;
    if (bandsLoading) return;

    setBandsLoading(true);
    setBandsError(null);

    try {
      if (bandsAbortRef.current) bandsAbortRef.current.abort();
      const controller = new AbortController();
      bandsAbortRef.current = controller;

      const page = reset ? 1 : bandsPageRef.current;
      const limit = clampLimit(bandsLimitRef.current);
      const base = `${apiEndpoints.bands}/search`;
      const url = buildUrl(base, debouncedQuery, page, limit);

      const json = await httpGetJson(url, { signal: controller.signal, retries: 1 });
      const { items, page: respPage, limit: respLimit } = parsePaginated<BandItem>(json, page, limit);

      bandsLimitRef.current = clampLimit(respLimit || limit);
      bandsPageRef.current = (reset ? 1 : page) + 1;
      bandsHasMoreRef.current = (items?.length ?? 0) >= clampLimit(bandsLimitRef.current);

      setBands(prev => (reset ? items : [...prev, ...items]));
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
      setBandsError(e?.message || 'Failed to load bands');
    } finally {
      setBandsLoading(false);
    }
  }, [debouncedQuery, bandsLoading, clampLimit]);

  // Fetch all stores (preview) or search stores
  const fetchStores = useCallback(async () => {
    // If user typed query, use search endpoint; otherwise list all stores
    if (storesLoading) return;
    setStoresLoading(true);
    setStoresError(null);
    try {
      if (storesAbortRef.current) storesAbortRef.current.abort();
      const controller = new AbortController();
      storesAbortRef.current = controller;

      const url = debouncedQuery
        ? `${apiEndpoints.musicStoresSearch}?q=${encodeURIComponent(debouncedQuery)}`
        : `${apiEndpoints.musicStores}`;

      const json = await httpGetJson(url, { signal: controller.signal, retries: 1 });
      // normalize: search returns {stores: [...]} while list returns {stores: [...]}
      const items: MusicStore[] = Array.isArray(json)
        ? (json as MusicStore[])
        : Array.isArray(json?.stores)
          ? (json.stores as MusicStore[])
          : [];
      setStores(items);
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
      setStoresError(e?.message || 'Failed to load stores');
    } finally {
      setStoresLoading(false);
    }
  }, [debouncedQuery, storesLoading]);

  const fetchOpportunities = useCallback(async (opts?: { reset?: boolean }) => {
    // opportunities listing should work even for empty query (public list)
    const reset = !!opts?.reset;
    if (opportunitiesLoading) return;

    setOpportunitiesLoading(true);
    setOpportunitiesError(null);

    try {
      if (opportunitiesAbortRef.current) {
        opportunitiesAbortRef.current.abort();
      }
      const controller = new AbortController();
      opportunitiesAbortRef.current = controller;

      const page = reset ? 1 : opportunitiesPageRef.current;
      const limit = clampLimit(opportunitiesLimitRef.current);

      // Build URL: allow optional q search param
      const params = new URLSearchParams();
      if (debouncedQuery) params.set('q', debouncedQuery);
      params.set('page', String(page));
      params.set('limit', String(limit));

      const url = `${apiEndpoints.opportunities}?${params.toString()}`;

      const json = await httpGetJson(url, { signal: controller.signal, retries: 1 });
      const { items, page: respPage, limit: respLimit } = parsePaginated<Opportunity>(json, page, limit);

      opportunitiesLimitRef.current = clampLimit(respLimit || limit);
      opportunitiesPageRef.current = (reset ? 1 : page) + 1;
      opportunitiesHasMoreRef.current = (items?.length ?? 0) >= clampLimit(opportunitiesLimitRef.current);

      setOpportunities(prev => (reset ? items : [...prev, ...items]));
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
      setOpportunitiesError(e?.message || 'Failed to load gigs');
    } finally {
      setOpportunitiesLoading(false);
    }
  }, [debouncedQuery, opportunitiesLoading, clampLimit]);

  // Utility: shuffle an array (Fisher-Yates)
  const shuffle = <T,>(arr: T[]) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  // Fetch featured venues preview on mount
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    featuredAbortRef.current = controller;

    const loadFeaturedVenues = async () => {
      setFeaturedLoading(true);
      setFeaturedError(null);
      try {
        const json = await httpGetJson(apiEndpoints.featuredVenues + '?limit=8', { signal: controller.signal, retries: 1 });
        const items = Array.isArray(json) ? json : (json?.items ?? []);
        const typed = items as Venue[];
        if (!cancelled) setFeaturedVenues(shuffle(typed).slice(0, 4));
      } catch (e: any) {
        if (e?.name === 'AbortError') return;
        setFeaturedError(e?.message || 'Failed to load featured venues');
      } finally {
        if (!cancelled) setFeaturedLoading(false);
      }
    };

    loadFeaturedVenues();
    return () => { cancelled = true; controller.abort(); };
  }, []);

  // Fetch featured artists (preview) and preview opportunities on mount
  useEffect(() => {
    let cancelled = false;

    const controller = new AbortController();
    featuredArtistsAbortRef.current = controller;
    const loadFeaturedArtists = async () => {
      setFeaturedArtistsLoading(true);
      setFeaturedArtistsError(null);
      try {
        const json = await httpGetJson(apiEndpoints.featuredArtists + '?limit=8', { signal: controller.signal, retries: 1 });
  const items = Array.isArray(json) ? json : (json?.items ?? []);
  const typed = items as Artist[];
  if (!cancelled) setFeaturedArtists(shuffle(typed).slice(0, 4));
      } catch (e: any) {
        if (e?.name === 'AbortError') return;
        setFeaturedArtistsError(e?.message || 'Failed to load featured artists');
      } finally {
        if (!cancelled) setFeaturedArtistsLoading(false);
      }
    };
    loadFeaturedArtists();
    return () => { cancelled = true; controller.abort(); };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    previewOppAbortRef.current = controller;
    const loadPreviewOpps = async () => {
      setPreviewOpportunitiesLoading(true);
      setPreviewOpportunitiesError(null);
      try {
        const json = await httpGetJson(apiEndpoints.opportunities + '?page=1&limit=8', { signal: controller.signal, retries: 1 });
  const items = Array.isArray(json) ? json : (json?.items ?? json?.data ?? []);
  const typed = items as Opportunity[];
  if (!cancelled) setPreviewOpportunities(shuffle(typed).slice(0, 4));
      } catch (e: any) {
        if (e?.name === 'AbortError') return;
        setPreviewOpportunitiesError(e?.message || 'Failed to load gigs');
      } finally {
        if (!cancelled) setPreviewOpportunitiesLoading(false);
      }
    };
    loadPreviewOpps();
    return () => { cancelled = true; controller.abort(); };
  }, []);

  // Trigger search when tab or query changes
  useEffect(() => {
    // Reset pagination and results when switching context
    if (!debouncedQuery) {
      setBands([]);
      setArtists([]);
      setVenues([]);
      artistsPageRef.current = 1;
      venuesPageRef.current = 1;
      artistsHasMoreRef.current = true;
      venuesHasMoreRef.current = true;
      setArtistsError(null);
      setVenuesError(null);
      return;
    }

    if (activeTab === 'Artists') {
      artistsPageRef.current = 1;
      artistsHasMoreRef.current = true;
      fetchArtists({ reset: true });
    } else if (activeTab === 'Venues') {
      venuesPageRef.current = 1;
      venuesHasMoreRef.current = true;
      fetchVenues({ reset: true });
    } else if (activeTab === 'Bands') {
      bandsPageRef.current = 1;
      bandsHasMoreRef.current = true;
      fetchBands({ reset: true });
    } else if (activeTab === 'Events') {
      opportunitiesPageRef.current = 1;
      opportunitiesHasMoreRef.current = true;
      fetchOpportunities({ reset: true });
    } else if (activeTab === 'Services') {
      // For Services tab, fetch stores (search or full list)
      fetchStores();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, debouncedQuery]);

  // Listen for navigation params (tags) and trigger fresh searches every time they change
  useEffect(() => {
    const q = typeof params?.q === 'string' ? params.q : null;
    const tabParam = typeof params?.tab === 'string' ? params.tab : null;

    // If no params provided, do nothing
    if (!q && !tabParam) return;

    // Update active tab immediately
    if (tabParam) setActiveTab(tabParam);

    // Clear previous cached results and pagination (always)
    setArtists([]);
    setVenues([]);
    setOpportunities([]);
    artistsPageRef.current = 1;
    venuesPageRef.current = 1;
    opportunitiesPageRef.current = 1;
    artistsHasMoreRef.current = true;
    venuesHasMoreRef.current = true;
    opportunitiesHasMoreRef.current = true;

    // Only programmatically set the query if the user hasn't started typing
    if (q && !userTypedRef.current) {
      userTypedRef.current = false; // ensure it's programmatic
      setQuery(q);
      // set debouncedQuery immediately so the fetch effect runs quickly
      setDebouncedQuery(q);
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params?.q, params?.tab]);

  // Pull to refresh: call the main fetchers depending on activeTab
  const { refreshControl, runRefresh } = require('../_utils/usePullToRefresh').default({
    onRefresh: async () => {
      // Reset and refetch relevant data
      if (activeTab === 'Artists') {
        artistsPageRef.current = 1;
        artistsHasMoreRef.current = true;
        await fetchArtists({ reset: true });
      } else if (activeTab === 'Venues') {
        venuesPageRef.current = 1;
        venuesHasMoreRef.current = true;
        await fetchVenues({ reset: true });
      } else if (activeTab === 'Events') {
        opportunitiesPageRef.current = 1;
        opportunitiesHasMoreRef.current = true;
        await fetchOpportunities({ reset: true });
      } else {
        // generic: refresh previews
        await Promise.all([
          (async () => { setFeaturedLoading(true); await (async () => {})().catch(()=>{}); setFeaturedLoading(false); })(),
        ]);
      }
    }
  });

  const isCloseToBottom = useCallback((nativeEvent: any) => {
    const paddingToBottom = 100;
    return nativeEvent.layoutMeasurement.height + nativeEvent.contentOffset.y >=
      nativeEvent.contentSize.height - paddingToBottom;
  }, []);

  const handleScroll = useCallback((e: any) => {
    if (!debouncedQuery) return;
    const { nativeEvent } = e;
    if (!isCloseToBottom(nativeEvent)) return;

    if (activeTab === 'Artists' && !artistsLoading && artistsHasMoreRef.current) {
      fetchArtists();
    } else if (activeTab === 'Venues' && !venuesLoading && venuesHasMoreRef.current) {
      fetchVenues();
    } else if (activeTab === 'Bands' && !bandsLoading && bandsHasMoreRef.current) {
      fetchBands();
    } else if (activeTab === 'Events' && !opportunitiesLoading && opportunitiesHasMoreRef.current) {
      fetchOpportunities();
    }
  }, [debouncedQuery, activeTab, artistsLoading, venuesLoading, fetchArtists, fetchVenues, isCloseToBottom]);

  const handleFilterPress = (label: string) => {
    switch (label) {
      case 'Location':
        setLocationModalVisible(true);
        break;
      case 'Dates':
        setDateModalVisible(true);
        break;
      case 'Capacity':
        setCapacityModalVisible(true);
        break;
      default:
        break;
    }
  };

  const renderListContent = () => {
    switch (activeTab) {
      case 'Venues':
        if (debouncedQuery) {
          return venues.map((item) => (
            <Link key={String(item.club_id)} href={{ pathname: '/venue_details/[id]', params: { id: String(item.club_id) } }} asChild>
              <TouchableOpacity>
                <VenueListItem
                  name={item.name}
                  location={item.location_id}
                  capacity={item.capacity}
                  imageUrl={item.profile_image_url || 'https://picsum.photos/seed/venue/400/300'}
                />
              </TouchableOpacity>
            </Link>
          ));
        }
        return featuredVenues.map((item, idx) => (
          <Link key={String(item.club_id ?? `fv-${idx}`)} href={{ pathname: '/venue_details/[id]', params: { id: String(item.club_id ?? '') } }} asChild>
            <TouchableOpacity>
              <VenueListItem
                name={item.name}
                location={item.location_id}
                capacity={item.capacity}
                imageUrl={item.profile_image_url || 'https://picsum.photos/seed/venue/400/300'}
              />
            </TouchableOpacity>
          </Link>
        ));
      case 'Artists':
        if (debouncedQuery) {
          return artists.map((item) => (
            <Link key={String(item.artist_id)} href={{ pathname: '/artist_details/[id]', params: { id: String(item.artist_id) } }} asChild>
              <TouchableOpacity>
                <ArtistListItem
                  name={item.name}
                  location={item.location_id}
                  imageUrl={item.profile_image_url || 'https://picsum.photos/seed/artist/400/300'}
                />
              </TouchableOpacity>
            </Link>
          ));
        }
        // show featured artists preview when no query
        if (featuredArtists.length > 0) {
          return featuredArtists.map((item) => (
            <Link key={String(item.artist_id)} href={{ pathname: '/artist_details/[id]', params: { id: String(item.artist_id) } }} asChild>
              <TouchableOpacity>
                <ArtistListItem name={item.name} location={item.location_id} imageUrl={item.profile_image_url || 'https://picsum.photos/seed/artist/400/300'} />
              </TouchableOpacity>
            </Link>
          ));
        }
        return artistData.map((item, index) => (
          <Link key={`preview-artist-${index}`} href={{ pathname: '/artist_details/[id]', params: { id: String((item as any).artist_id ?? '') } }} asChild>
            <TouchableOpacity>
              <ArtistListItem name={item.name} location={(item as any).location} imageUrl={(item as any).profile_image_url || (item as any).imageUrl || 'https://picsum.photos/seed/artist/400/300'} />
            </TouchableOpacity>
          </Link>
        ));
      case 'Events':
        if (debouncedQuery) {
          // Prefer server results when available
          if ((opportunities?.length ?? 0) > 0) {
            const list = selectedDate ? opportunities.filter(o => (o.event_date ?? '').slice(0,10) === selectedDate) : opportunities;
            return list.map((item) => (
              <OpportunityListItem
                key={item.opportunity_id}
                opportunity_id={item.opportunity_id}
                title={item.title}
                description={item.description}
                event_date={item.event_date}
                event_time={item.event_time}
              />
            ));
          }

          // Client-side fallback: filter preview opportunities for quick matches
          const q = debouncedQuery.toLowerCase();
          const fallback = previewOpportunities.filter((item) => {
            const t = (item.title ?? '') as string;
            const d = (item.description ?? '') as string;
            const dt = (item.event_date ?? '') as string;
            return t.toLowerCase().includes(q) || d.toLowerCase().includes(q) || dt.toLowerCase().includes(q);
          });

          if (fallback.length > 0) {
            const list = selectedDate ? fallback.filter(o => (o.event_date ?? '').slice(0,10) === selectedDate) : fallback;
            if (list.length > 0) {
              return list.map((item, index) => (
                <OpportunityListItem 
                  key={item.opportunity_id} 
                  opportunity_id={item.opportunity_id}
                  title={item.title ?? 'Untitled'} 
                  description={item.description ?? ''} 
                  event_date={item.event_date ?? ''} 
                  event_time={item.event_time ?? ''} 
                />
              ));
            }
          }

          return <Text style={styles.textSecondary}>No gigs found</Text>;
        }

        const previewList = selectedDate ? previewOpportunities.filter(o => (o.event_date ?? '').slice(0,10) === selectedDate) : previewOpportunities;
        if (previewList.length === 0) return <Text style={styles.textSecondary}>No gigs found</Text>;
        return previewList.map((item) => (
          <OpportunityListItem 
            key={item.opportunity_id} 
            opportunity_id={item.opportunity_id}
            title={item.title ?? 'Untitled'} 
            description={item.description ?? ''} 
            event_date={item.event_date ?? ''} 
            event_time={item.event_time ?? ''} 
          />
        ));
      case 'Services':
        if (storesLoading) return <Text style={styles.textSecondary}>Loading stores...</Text>;
        if (storesError) return <Text style={styles.textSecondary}>Error: {storesError}</Text>;
        if (!stores || stores.length === 0) {
          return <Text style={styles.textSecondary}>{debouncedQuery ? 'No stores found' : 'No stores available'}</Text>;
        }
        return stores.map((s) => (
          <StoreListItem key={String(s.id)} store={s} />
        ));
      case 'Bands':
        if (debouncedQuery) {
          return bands.map((b) => (
            <BandListItem key={String(b.band_id)} band={b} />
          ));
        }
        return <Text style={styles.textSecondary}>Search bands by name or description</Text>;
      default:
        return null;
    }
  };

  // --- Modal Components ---
  const ModalContent = ({ title, options, onClose }: { title: string; options: string[]; onClose: () => void }) => (
    <View style={styles.modalContainer}>
      <View style={styles.modalContent}>
        <Text style={styles.modalTitle}>{title}</Text>
        <ScrollView>
          {options.map((option, index) => (
            <TouchableOpacity key={index} style={styles.modalOption}>
              <Text style={styles.modalOptionText}>{option}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Text style={styles.closeButtonText}>Close</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const CalendarModal = ({ onClose, onPickDate }: { onClose: () => void; onPickDate: (date: string) => void }) => {
    const today = new Date();
    const [year, setYear] = useState(today.getFullYear());
    const [month, setMonth] = useState(today.getMonth()); // 0-indexed

    const firstOfMonth = new Date(year, month, 1);
    const startDay = firstOfMonth.getDay(); // 0 Sun - 6 Sat
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const prevMonth = () => {
      setMonth(m => (m === 0 ? 11 : m - 1));
      if (month === 0) setYear(y => y - 1);
    };
    const nextMonth = () => {
      setMonth(m => (m === 11 ? 0 : m + 1));
      if (month === 11) setYear(y => y + 1);
    };

    const pickDate = (d: number) => {
      const dt = new Date(year, month, d);
      const iso = dt.toISOString().slice(0, 10);
      onPickDate(iso);
      onClose();
    };

    const weeks: (number | null)[] = [];
    // fill leading nulls
    let dayCounter = 1;
    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 7; j++) {
        const cellIndex = i * 7 + j;
        const calc = cellIndex - startDay + 1;
        if (calc > 0 && calc <= daysInMonth) weeks.push(calc);
        else weeks.push(null);
      }
    }

    return (
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <TouchableOpacity onPress={prevMonth}>
              <Text style={styles.modalTitle}>{'<'}</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{`${months[month]} ${year}`}</Text>
            <TouchableOpacity onPress={nextMonth}>
              <Text style={styles.modalTitle}>{'>'}</Text>
            </TouchableOpacity>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
            {['S','M','T','W','T','F','S'].map((d, i) => (
              <Text key={`wd-${i}`} style={{ width: 32, textAlign: 'center', fontWeight: '600' }}>{d}</Text>
            ))}
          </View>
          <View style={{ flexWrap: 'wrap', flexDirection: 'row', marginTop: 8 }}>
            {weeks.map((d, idx) => (
              <TouchableOpacity key={idx} onPress={() => d && pickDate(d)} style={{ width: 32, height: 36, justifyContent: 'center', alignItems: 'center', margin: 2 }}>
                <Text style={{ color: d ? '#111' : '#AAA' }}>{d ?? ''}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 }}>
            <TouchableOpacity onPress={() => { setSelectedDate(null); }} style={[styles.closeButton, { backgroundColor: '#eee' }]}>
              <Text style={[styles.closeButtonText, { color: '#111' }]}>Reset</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };
  
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
  <ScrollView onScroll={handleScroll} scrollEventThrottle={16} refreshControl={refreshControl}>
        {/* Top Header Image and Search Bar */}
        <View style={styles.topSection}>
          <ImageBackground 
          source={require('../../assets/images/searchbg.png')}  
             style={styles.topImage}
          >
            <View style={styles.header}>
               <Link href="/(tabs)" style={styles.iconContainer}>
               
              </Link> 
               
            </View>
            <View style={styles.searchSection}>
              <View style={styles.searchInputContainer}>
                <View style={styles.searchIcon}>
                  <MagnifyingGlassIcon />
                </View>
                <TextInput
                  placeholder="Search for venues, artists, events, services"
                  placeholderTextColor={Colors.secondary}
                  style={styles.input}
                  value={query}
                  onChangeText={(text) => {
                    userTypedRef.current = true;
                    setQuery(text);
                  }}
                />
              </View>
            </View>
          </ImageBackground>
        </View>

        {/* Tabs */}
        <View style={styles.tabsContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsContent}>
            <TouchableOpacity style={activeTab === 'Venues' ? styles.activeTab : styles.inactiveTab} onPress={() => setActiveTab('Venues')}>
              <Text style={activeTab === 'Venues' ? styles.activeTabText : styles.inactiveTabText}>Venues</Text>
            </TouchableOpacity>
            <TouchableOpacity style={activeTab === 'Bands' ? styles.activeTab : styles.inactiveTab} onPress={() => setActiveTab('Bands')}>
              <Text style={activeTab === 'Bands' ? styles.activeTabText : styles.inactiveTabText}>Bands</Text>
            </TouchableOpacity>
            <TouchableOpacity style={activeTab === 'Artists' ? styles.activeTab : styles.inactiveTab} onPress={() => setActiveTab('Artists')}>
              <Text style={activeTab === 'Artists' ? styles.activeTabText : styles.inactiveTabText}>Artists</Text>
            </TouchableOpacity>
            <TouchableOpacity style={activeTab === 'Events' ? styles.activeTab : styles.inactiveTab} onPress={() => setActiveTab('Events')}>
              <Text style={activeTab === 'Events' ? styles.activeTabText : styles.inactiveTabText}>Gigs</Text>
            </TouchableOpacity>
            <TouchableOpacity style={activeTab === 'Services' ? styles.activeTab : styles.inactiveTab} onPress={() => setActiveTab('Services')}>
              <Text style={activeTab === 'Services' ? styles.activeTabText : styles.inactiveTabText}>Services</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* Filter Buttons: only shown in Gigs (Events) tab; only Date filter */}
        {activeTab === 'Events' && (
          <View style={styles.filterSection}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterContainer}>
              <FilterButton
                label={selectedDate ? `Date: ${selectedDate}` : 'Date'}
                onPress={() => setDateModalVisible(true)}
              />
              {selectedDate && (
                <TouchableOpacity onPress={() => setSelectedDate(null)} style={[styles.filterButton, { backgroundColor: '#fff', marginLeft: 4 }] }>
                  <Text style={[styles.filterButtonText, { color: '#d00', paddingRight: 10 }]}>Clear</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        )}

        {/* Results List */}
        <Text style={styles.listTitle}>{activeTab}</Text>
        <View style={styles.listContainer}>
          {renderListContent()}
          {/* Error messages */}
          {!!artistsError && activeTab === 'Artists' && (
            <Text style={styles.textSecondary}>{artistsError}</Text>
          )}
          {!!venuesError && activeTab === 'Venues' && debouncedQuery && (
            <Text style={styles.textSecondary}>{venuesError}</Text>
          )}
          {!!featuredError && activeTab === 'Venues' && !debouncedQuery && (
            <Text style={styles.textSecondary}>{featuredError}</Text>
          )}
          {!!opportunitiesError && activeTab === 'Events' && (
            <Text style={styles.textSecondary}>{opportunitiesError}</Text>
          )}
          {opportunitiesLoading && activeTab === 'Events' && (
            <Text style={styles.textSecondary}>Loading gigs...</Text>
          )}
          {featuredLoading && activeTab === 'Venues' && !debouncedQuery && (
            <Text style={styles.textSecondary}>Loading...</Text>
          )}
        </View>
      </ScrollView>

      {/* Modals */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isLocationModalVisible}
        onRequestClose={() => setLocationModalVisible(false)}
      >
        <ModalContent
          title="Filter by Location"
          options={locationOptions}
          onClose={() => setLocationModalVisible(false)}
        />
      </Modal>
      <Modal
        animationType="slide"
        transparent={true}
        visible={isDateModalVisible}
        onRequestClose={() => setDateModalVisible(false)}
      >
        <CalendarModal onClose={() => setDateModalVisible(false)} onPickDate={(d) => { setSelectedDate(d); }} />
      </Modal>
      <Modal
        animationType="slide"
        transparent={true}
        visible={isCapacityModalVisible}
        onRequestClose={() => setCapacityModalVisible(false)}
      >
        <ModalContent
          title="Filter by Capacity"
          options={capacityOptions}
          onClose={() => setCapacityModalVisible(false)}
        />
      </Modal>
    </SafeAreaView>
  );
}
export { VenueListItem, ArtistListItem, BandListItem, OpportunityListItem };

// --- Stylesheet ---
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f3ede6',
  },
  topSection: {
    width: '100%',
    height: 218,
    backgroundColor: '#f3ede6',
  },
  topImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingTop: 90,
  },
  iconContainer: {
    width: 48,
    height: 48,     
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: Colors.primary,
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 48,
  },
  searchSection: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  searchInputContainer: {
    flexDirection: 'row',
    height: 48,
    width: '100%',
    backgroundColor: '#fffbf7',
    borderRadius: 12,
    alignItems: 'center',
  },
  searchIcon: {
    paddingLeft: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
  },
  input: {
    flex: 1,
    paddingHorizontal: 8,
    color: Colors.primary,
    fontSize: 16,
  },
  tabsContainer: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderColor,
    paddingHorizontal: 16,
    backgroundColor: '#f3ede6',
  },
  tabsContent: {
    gap: 32,
  },
  activeTab: {
    borderBottomWidth: 3,
    borderBottomColor: Colors.activeTabBorder,
    paddingVertical: 10,
  },
  inactiveTab: {
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
    paddingVertical: 10,
  },
  activeTabText: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: 'bold',
  },
  inactiveTabText: {
    color: Colors.secondary,
    fontSize: 14,
    fontWeight: 'bold',
  },
  filterSection: {
    paddingVertical: 15,
    backgroundColor: '#f3ede6',
  },
  filterContainer: {
    paddingHorizontal: 12,
    gap: 12,
  },
  filterButton: {
    flexDirection: 'row',
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#fffbf7',
    borderRadius: 999,
    paddingLeft: 16,
    paddingRight: 8,
  },
  filterButtonText: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '500',
  },
  listTitle: {
    color: Colors.primary,
    fontSize: 18,
    fontWeight: 'bold',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  listItemContainer: {
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'space-between',
    gap: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderColor,
  },
  listItemTextContainer: {
    flex: 2,
    gap: 4,
  },
  venueImage: {
    flex: 1,
    height: 'auto',
    aspectRatio: 16 / 9,
    borderRadius: 12,
    resizeMode: 'cover',
  },
  textPrimary: {
    color: Colors.primary,
    fontSize: 16,
    fontWeight: 'bold',
    lineHeight: 20,
  },
  textSecondary: {
    color: Colors.secondary,
    fontSize: 14,
    lineHeight: 18,
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end', // Position at the bottom
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: Colors.background,
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    width: '100%',
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
    color: Colors.primary,
  },
  modalOption: {
    paddingVertical: 15,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderColor,
  },
  modalOptionText: {
    fontSize: 16,
    textAlign: 'center',
    color: Colors.primary,
  },
  closeButton: {
    marginTop: 20,
    backgroundColor: Colors.activeTabBorder,
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#f3ede6',
    fontWeight: 'bold',
    fontSize: 16,
  },
  calendarImage: {
    width: '100%',
    height: 250,
    resizeMode: 'contain',
  },
});
