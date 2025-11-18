import { useLocalSearchParams, router, useNavigation } from 'expo-router';
import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    SafeAreaView,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    useWindowDimensions,
} from 'react-native';
import apiEndpoints from '../api/baseUrl';
import useUserData from '../_utils/Localstorage';

// Mocking Icon for improved UI. In a real app, you'd use react-native-vector-icons
// Using a simple text-based icon placeholder for minimal visual weight
const Icon = ({ name, size = 18, color = '#333', style }: any) => (
    <Text style={[{ fontSize: size, color, marginRight: 8 }, style]}>
        {/* Placeholder for actual icon character */}
        •
    </Text>
);

// Helper function to safely derive the venue-specific API URL
const getVenueUrl = (venueId: string) => {
    const baseApi = apiEndpoints.featuredVenues.replace(/venues\/featured\/?$/, '');
    return `${baseApi}venues/${venueId}`;
};

const ACCENT_COLOR = '#795548'; // Elegant Taupe/Brown
const TEXT_DARK = '#333333';
const TEXT_MUTED = '#888888';
const BACKGROUND_LIGHT = '#FFFFFF';

type Opportunity = { id: string; title: string; date?: string };
type Venue = {
    id?: string | number;
    name?: string;
    location?: string;
    description?: string;
    capacity?: number;
    created_at?: string;
    profile_image_url?: string;
    opportunities?: Opportunity[];
};

const venueCache: Record<string, { data: Venue; ts: number }> = {};
const VENUE_CACHE_TTL_MS = 5 * 60 * 1000;

const VenueDetailsScreen = () => {
    const { id } = useLocalSearchParams();
    const venueId = String(id ?? '');
    const [venue, setVenue] = useState<Venue | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { user } = useUserData();
    const currentUserType = user?.artist_id ? 'artist' : 'club';
    const currentUserId = (user as any)?.artist_id ?? (user as any)?.club_id ?? (user as any)?.id;
    const navigation = useNavigation();
    const { width } = useWindowDimensions();
    const titleFontSize = useMemo(() => Math.max(16, Math.min(28, width * 0.045)), [width]);

    // Function to fetch venue details (kept external/consistent for clarity)
    const fetchVenue = async (controller: AbortController, isCancelled: () => boolean) => {
        setLoading(true);
        setError(null);
        try {
            const url = getVenueUrl(venueId);
            const cache = venueCache[venueId];
            if (cache && Date.now() - cache.ts < VENUE_CACHE_TTL_MS) {
                if (!isCancelled()) setVenue(cache.data);
            }
            const res = await fetch(url, { signal: controller.signal });
            
            if (!res.ok) {
                const text = await res.text().catch(() => 'Unknown error');
                throw new Error(text || `Failed to fetch venue: ${res.status}`);
            }
            
            const json: Venue = await res.json();
            venueCache[venueId] = { data: json, ts: Date.now() };
            if (!isCancelled()) setVenue(json);
        } catch (e: any) {
            if (e?.name === 'AbortError') return;
            setError(e?.message || 'Could not load venue details.');
        } finally {
            if (!isCancelled()) setLoading(false);
        }
    };

    useEffect(() => {
        if (!venueId) {
            setError('Venue ID not provided.');
            return;
        }
        let cancelled = false;
        const controller = new AbortController();
        
        fetchVenue(controller, () => cancelled);

        return () => { cancelled = true; controller.abort(); };
    }, [venueId]);

    useLayoutEffect(() => {
        const title = venue?.name ?? (loading ? 'Loading…' : 'Venue Details');
        try {
            navigation.setOptions({
                title,
                headerTitleStyle: { fontWeight: '800', color: TEXT_DARK, fontSize: 18 },
            } as any);
        } catch {}
    }, [navigation, venue, loading]);

    // --- Handlers (Logging for demo) ---
    const handleBackPress = () => {
        try { router.back(); } catch { /* noop */ }
    };
    const handleVenueChatPress = (venueName: string, venueId: string) => {
        try {
            if (!currentUserType || !currentUserId) {
                setError('Please sign in to start a conversation.');
                return;
            }
            router.push(`/chats?sender_type=${currentUserType}&sender_id=${currentUserId}&receiver_type=club&receiver_id=${venueId}`);
        } catch (e) {
            console.warn('Failed to navigate to chat', e);
        }
    };
    const handleOpportunityChatPress = (opportunityId: string) => {
        console.log(`Navigating to chat for opportunity: ${opportunityId}`);
    };
    const handleOpportunityViewPress = (opportunityId: string) => {
        console.log(`Viewing details for opportunity: ${opportunityId}`);
    };
    // ------------------------------------

    const renderDetailRow = (label: string, value: string) => (
        <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>{label}</Text>
            <Text style={styles.detailValue}>{value}</Text>
        </View>
    );

    const renderOpportunityCard = (op: any) => (
        <View key={op.id} style={styles.opportunityCard}>
            <View style={styles.opportunityTextContent}>
                <Text style={styles.opportunityTitle}>{op.title}</Text>
                <View style={styles.opportunityMeta}>
                    <Text style={styles.opportunityDate}>
                        {op.date ? new Date(op.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Date not set'}
                    </Text>
                </View>
            </View>
            
            <View style={styles.opportunityActions}>
                <TouchableOpacity 
                    onPress={() => handleOpportunityChatPress(op.id)} 
                    style={[styles.actionButton, { borderColor: ACCENT_COLOR }]}
                >
                    <Text style={[styles.actionButtonText, { color: ACCENT_COLOR }]}>Chat</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                    onPress={() => handleOpportunityViewPress(op.id)} 
                    style={[styles.actionButton, { backgroundColor: ACCENT_COLOR, borderColor: ACCENT_COLOR, marginLeft: 10 }]}
                >
                    <Text style={[styles.actionButtonText, { color: BACKGROUND_LIGHT }]}>View</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    const renderContent = () => {
        if (loading) {
            return (
                <View style={styles.centeredMessage}>
                    <ActivityIndicator size="large" color={ACCENT_COLOR} />
                    <Text style={styles.infoText}>Loading venue details...</Text>
                </View>
            );
        }

        if (error || !venue) {
            return (
                <View style={styles.centeredMessage}>
                    <Text style={styles.errorText}>{error || 'Venue not found.'}</Text>
                    <TouchableOpacity style={styles.retryButton} onPress={() => fetchVenue(new AbortController(), () => false)}>
                        <Text style={styles.retryButtonText}>Try Again</Text>
                    </TouchableOpacity>
                </View>
            );
        }

        return (
            <>
                {/* --- Hero Image --- */}
                <View style={styles.heroWrapper}>
                    <Image
                        source={{ uri: venue.profile_image_url || 'https://picsum.photos/seed/elegant/800/300' }}
                        style={styles.heroImage}
                        resizeMode="cover"
                    />
                </View>

                {/* --- Basic Info & Venue Chat --- */}
                <View style={styles.infoContainer}>
                    <Text style={styles.title}>{venue.name ?? 'Venue Details'}</Text>
                    <View style={styles.addressRow}>
                        <Icon name="map" size={16} color={TEXT_MUTED} />
                        <Text style={styles.address}>{venue.location ?? 'Location not available'}</Text>
                    </View>
                    <Text style={styles.description}>{venue.description ?? 'No description provided.'}</Text>
                    
                    {/* Venue Chat Button (Under Info) */}
                    <TouchableOpacity 
                        style={styles.venueChatButton}
                        onPress={() => handleVenueChatPress(String(venue?.name ?? ''), venueId)}
                    >
                        <Text style={styles.venueChatButtonText}>Start Conversation</Text>
                        <Icon name="chat" size={16} color={BACKGROUND_LIGHT} style={{marginLeft: 10}}/>
                    </TouchableOpacity>
                </View>

                {/* --- Details List (Capacity, Dates) --- */}
                <View style={styles.sectionDivider} />
                <View style={styles.sectionContainer}>
                    <Text style={styles.sectionHeader}>Venue Details</Text>
                    {renderDetailRow('Capacity', venue.capacity ? `${venue.capacity} guests` : '—')}
                    {renderDetailRow('Joined', venue.created_at ? new Date(venue.created_at).toLocaleDateString() : '—')}
                </View>
                <View style={styles.sectionDivider} />


                {/* --- Opportunities Section --- */}
                <View style={styles.sectionContainer}>
                    <Text style={styles.sectionHeader}>Current Opportunities</Text>
                </View>
                
                {Array.isArray(venue.opportunities) && venue.opportunities.length > 0 ? (
                    <View style={styles.opportunitiesWrapper}>
                        {venue.opportunities.map(renderOpportunityCard)}
                    </View>
                ) : (
                    <Text style={styles.emptyOpportunities}>
                        No current opportunities are listed.
                    </Text>
                )}
                <View style={styles.finalSpacer} />
            </>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header} accessible accessibilityRole="header" accessibilityLabel={venue?.name ? `Venue ${venue.name}` : 'Venue Details'}>
                <TouchableOpacity style={styles.headerIconContainer} onPress={handleBackPress} accessibilityRole="button" accessibilityLabel="Go back">
                    <Text style={styles.headerIconText}>←</Text>
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    {loading && !venue ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <ActivityIndicator size="small" color={ACCENT_COLOR} />
                            <Text style={styles.infoText}> Loading…</Text>
                        </View>
                    ) : (
                        <Text numberOfLines={1} style={[styles.headerTitle, { fontSize: titleFontSize }]} accessibilityRole="header">{venue?.name ?? 'Venue Details'}</Text>
                    )}
                </View>
                <View style={styles.headerIconContainer} />
            </View>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                {renderContent()}
            </ScrollView>

            {/* --- Floating Action Button for Venue Chat --- */}
            {venue && !loading && !error && (
                <TouchableOpacity 
                    style={styles.fab}
                    onPress={() => handleVenueChatPress(String(venue?.name ?? ''), venueId)}
                >
                    <Icon name="chat" size={24} color={BACKGROUND_LIGHT} style={{marginRight: 0}} />
                </TouchableOpacity>
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F7F7F7', // Very light gray background
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        paddingBottom: 8,
        backgroundColor: BACKGROUND_LIGHT,
    },
    headerIconContainer: {
        width: 48,
        height: 48,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerIconText: {
        fontSize: 24,
        color: TEXT_DARK,
    },
    headerCenter: {
        flex: 1,
        alignItems: 'center',
        marginHorizontal: 8,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: TEXT_DARK,
    },
    scrollContent: {
        flexGrow: 1,
        paddingBottom: 80, // Space for FAB
    },
    // --- Hero Section ---
    heroWrapper: {
        width: '100%',
        height: 250,
        backgroundColor: '#E0E0E0',
        marginBottom: 20, // Space after image
    },
    heroImage: {
        width: '100%',
        height: '100%',
    },
    // --- Info & Detail Containers ---
    infoContainer: {
        paddingHorizontal: 20,
        marginBottom: 10,
    },
    sectionContainer: {
        paddingHorizontal: 20,
        paddingVertical: 10,
    },
    sectionDivider: {
        height: 1,
        backgroundColor: '#EEEEEE',
        marginHorizontal: 20,
        marginVertical: 10,
    },
    sectionHeader: {
        fontSize: 14,
        fontWeight: '600',
        color: TEXT_MUTED,
        letterSpacing: 1,
        textTransform: 'uppercase',
        marginBottom: 10,
        paddingTop: 5,
    },
    // --- Typography & Details ---
    title: {
        fontSize: 28,
        fontWeight: '800',
        color: TEXT_DARK,
        marginBottom: 5,
    },
    addressRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 15,
    },
    address: {
        color: TEXT_MUTED,
        fontSize: 14,
    },
    description: {
        color: TEXT_DARK,
        fontSize: 16,
        lineHeight: 24,
        marginBottom: 20,
    },
    detailItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#F7F7F7',
    },
    detailLabel: {
        color: TEXT_MUTED,
        fontSize: 15,
    },
    detailValue: {
        color: TEXT_DARK,
        fontSize: 15,
        fontWeight: '600',
    },
    // --- Venue Chat Button (Under Info) ---
    venueChatButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: ACCENT_COLOR,
        paddingVertical: 12,
        borderRadius: 4,
        marginTop: 10,
    },
    venueChatButtonText: {
        color: BACKGROUND_LIGHT,
        fontSize: 16,
        fontWeight: '600',
    },
    // --- Opportunities ---
    opportunitiesWrapper: {
        paddingHorizontal: 20,
    },
    opportunityCard: {
        backgroundColor: BACKGROUND_LIGHT,
        marginBottom: 15,
        padding: 15,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#EEEEEE', // Subtle border
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    opportunityTextContent: {
        flex: 1,
        marginRight: 15,
    },
    opportunityTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: TEXT_DARK,
        marginBottom: 4,
    },
    opportunityMeta: {
        flexDirection: 'row',
    },
    opportunityDate: {
        color: TEXT_MUTED,
        fontSize: 13,
    },
    opportunityActions: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    actionButton: {
        paddingHorizontal: 15,
        paddingVertical: 8,
        borderRadius: 4,
        borderWidth: 1, // All buttons have a border
    },
    actionButtonText: {
        fontSize: 13,
        fontWeight: '600',
        textTransform: 'uppercase',
    },
    emptyOpportunities: {
        paddingHorizontal: 20,
        paddingVertical: 15,
        color: TEXT_MUTED,
        textAlign: 'center',
        fontSize: 14,
    },
    finalSpacer: {
        height: 40,
    },
    // --- Status Messages ---
    centeredMessage: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
        minHeight: 200,
    },
    infoText: {
        paddingTop: 10,
        color: TEXT_MUTED,
        textAlign: 'center',
        fontSize: 16,
    },
    errorText: {
        paddingTop: 10,
        color: '#D32F2F',
        textAlign: 'center',
        fontWeight: '600',
        fontSize: 16,
    },
    retryButton: {
        backgroundColor: ACCENT_COLOR,
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 4,
        marginTop: 20,
    },
    retryButtonText: {
        color: BACKGROUND_LIGHT,
        fontSize: 15,
        fontWeight: '500',
    },
    // --- Floating Action Button (FAB) ---
    fab: {
        position: 'absolute',
        bottom: 25,
        right: 25,
        backgroundColor: ACCENT_COLOR,
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2, // Subtle shadow
        shadowRadius: 3,
        elevation: 4,
    },
});

export default VenueDetailsScreen;