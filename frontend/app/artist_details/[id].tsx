import { useLocalSearchParams, router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    Image,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiEndpoints from '../api/baseUrl';

// Get screen width for responsive image/layout adjustments
const { width } = Dimensions.get('window');

// --- Icon Component Placeholder ---
type IconProps = {
    name: string;
    size?: number;
    color?: string;
    children?: React.ReactNode;
};

const Icon = ({ size = 24, children }: IconProps) => (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        {children}
    </View>
);

// --- Component Start ---
const ArtistProfileScreen = () => {
    const { id } = useLocalSearchParams ();
    const artistId = String(id ?? '');

    const [artist, setArtist] = useState<any | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [chatLoading, setChatLoading] = useState(false);
    const [chatError, setChatError] = useState<string | null>(null);

    // Function to fetch artist details (extracted for reusability/clarity)
    const fetchArtist = async (controller: AbortController, isCancelled: () => boolean) => {
        setLoading(true);
        setError(null);
        try {
            const baseApi = apiEndpoints.featuredVenues.replace('venues/featured', '');
            const url = `${baseApi}artists/${artistId}`;
            const res = await fetch(url, { signal: controller.signal });

            if (!res.ok) {
                const text = await res.text().catch(() => '');
                throw new Error(text || `Failed to fetch artist (${res.status})`);
            }
            const json = await res.json();
            if (!isCancelled()) setArtist(json);
        } catch (e: any) {
            if (e?.name === 'AbortError') return;
            setError(e?.message || 'Failed to load artist');
        } finally {
            if (!isCancelled()) setLoading(false);
        }
    };

    useEffect(() => {
        if (!artistId) return;
        let cancelled = false;
        const controller = new AbortController();

        fetchArtist(controller, () => cancelled);

        return () => { cancelled = true; controller.abort(); };
    }, [artistId]);

    // --- Handlers ---
    const handleBackPress = () => {
        try { router.back(); } catch { /* noop */ }
    };

    const handleSharePress = () => {
        console.log('Share profile');
        // Example: Share.share({ message: 'Check out this artist!' });
    };

    const handleEmailPress = () => {
        console.log('Open email app');
        // Example: Linking.openURL('mailto:ethan.carter@email.com');
    };

    const handleInstagramPress = () => {
        console.log('Open Instagram profile');
        // Example: Linking.openURL('https://instagram.com/ethan_carter_music');
    };

    const handleChatPress = async () => {
        setChatError(null);
        // Prevent action if artist not loaded
        if (!artistId) {
            setChatError('Artist ID unavailable. Please try again.');
            return;
        }
        if (!artist) {
            setChatError('Artist details not loaded yet.');
            return;
        }

        try {
            setChatLoading(true);
            // Authorization check: require token for chat
            const token = await AsyncStorage.getItem('userToken');
            if (!token) {
                setChatError('Please sign in to start a chat.');
                setChatLoading(false);
                return;
            }

            // Build safe, minimal metadata payload
            const params: Record<string, string> = {
                receiver_type: 'artist',
                receiver_id: String(artistId),
                receiver_name: String(artist?.name ?? ''),
                receiver_avatar: String(artist?.profile_image_url ?? ''),
                receiver_username: String(artist?.username ?? ''),
                receiver_category: String(artist?.genre ?? artist?.specialization ?? ''),
                // keep meta short to avoid very long URLs; stringify only essentials
                receiver_meta: JSON.stringify({
                    bio: artist?.bio ?? '',
                    instagram: artist?.instagram ?? '',
                    email: artist?.email ?? '',
                }),
            };

            router.push({ pathname: '/chats', params });
        } catch (e: any) {
            setChatError(e?.message || 'Failed to open chat');
        } finally {
            setChatLoading(false);
        }
    };

    // --- Render Helpers ---
    const renderContactItem = (icon: React.ReactNode, title: string, subtitle: string, onPress?: () => void) => (
        <TouchableOpacity style={styles.contactItem} onPress={onPress} disabled={!onPress}>
            <View style={styles.contactIconWrapper}>
                {icon}
            </View>
            <View style={styles.contactTextContainer}>
                <Text style={styles.contactTitle} numberOfLines={1}>{title}</Text>
                <Text style={styles.contactSubtitle} numberOfLines={2}>{subtitle}</Text>
            </View>
        </TouchableOpacity>
    );

    if (loading && !artist) {
        return (
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.centeredMessage}>
                    <ActivityIndicator size="large" color="#6b6057" />
                    <Text style={{ marginTop: 10, color: '#77726e' }}>Loading artist profile...</Text>
                </View>
            </SafeAreaView>
        );
    }

    if (error) {
        return (
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.centeredMessage}>
                    <Text style={{ color: 'red', fontWeight: 'bold' }}>Error: {error}</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.container}>
                {/* --- Header --- */}
                <View style={styles.header}>
                    <TouchableOpacity style={styles.headerIconContainer} onPress={handleBackPress}>
                        <Text style={styles.headerIconText}>←</Text>
                    </TouchableOpacity>
                    <View style={styles.headerCenter}>
                        <Text numberOfLines={1} style={styles.headerTitle}>{artist?.name ?? 'Artist Details'}</Text>
                    </View>
                    <TouchableOpacity style={styles.headerIconContainer} onPress={handleSharePress}>
                        <Text style={styles.headerIconText}>⇪</Text>
                    </TouchableOpacity>
                </View>

                <ScrollView contentContainerStyle={styles.scrollContent}>

                    {/* --- Hero Image --- */}
                    <View style={styles.heroContainer}>
                        <Image
                            source={{ uri: artist?.profile_image_url || "https://lh3.googleusercontent.com/aida-public/AB6AXuAo-MOEWzZ0Z4F8ChIPRQGiG2h6Rv8qqoxWzGECD93VIe7CeSZMcE3wZySENYX3LjKCexRjk8UPBWlW846lmkK_hMuYqq7iThyo3YHd5A-QtRqoMgvjPH5GTk5j7hvBgX_6yZWtb_Ji8prUd8HFwLDXYr7whx6AtBXj697Vgx4RSBluIy1hn8o0ecXPvgAac6QEB7oNz7rWinjd49jUNH9iilH8zbhVBU8yURjVPAE_SLOCK9x_nhfE-rfArrz2sYPe5x-UKUq6M6k" }}
                            style={styles.heroImage}
                            resizeMode="cover"
                        />
                    </View>

                    {/* --- Basic Info --- */}
                    <View style={styles.paddingHorizontal}>
                        {/* Removed duplicate paddingHorizontal from text styles */}
                        <Text style={styles.title}>{artist?.name ?? 'Ethan Carter'}</Text>
                        <Text style={styles.subtitle}>{artist?.genre ?? 'Indie Pop'}</Text>
                        <Text style={styles.bodyText}>
                            {artist?.bio ?? `Ethan Carter is an indie pop artist known for his introspective lyrics and catchy melodies. His music often explores themes of love, loss, and self-discovery, resonating with a wide audience. With a growing fanbase and critical acclaim, Ethan continues to push the boundaries of the genre.`}
                        </Text>
                    </View>

                    {/* --- Portfolio / Media --- */}
                    <Text style={[styles.sectionTitle, styles.paddingHorizontal]}>Portfolio</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.portfolioScroll}>
                        <View style={styles.portfolioContent}>
                            {(Array.isArray(artist?.media) && artist.media.length > 0 ? artist.media : [
                                { title: 'Live at The Roxy', uri: "https://lh3.googleusercontent.com/aida-public/AB6AXuAbcRh8cO3-fS4r2A9z3NuEn5mqyDoYQmnf4BJPtZgE2UydwQMsYk5uAtB5gO9QMTiOBYVqoiQx45VU5e0sRLxmQVJMPEu7ixfZf6kDqIbLJbHoS9vo5pgpXpKFXOZVHP0x09oO5jIS-IgVAabT71EYwGtRIaMWf5hUCAafRaO-Ejp9M9_PhRCO28e1S2Kbu7jNRoenF4byhj37c0_NGHM_jtbCrstO5GPqFChGx75tESNZrDwiVdLPqoqmZfpLrLVPvjEh9-gLzH8" },
                                { title: 'Acoustic Session', uri: "https://lh3.googleusercontent.com/aida-public/AB6AXuCzIfSh8k2Drgv5ETZTAX1KpA5VB99m8YkCxxt2PumxpEmO32BRs2a0_38INBOkepmUgveAOltB5n3EqxxnVg9ra9xjM44OZytSb5U_dpmBNV6XoaqhRpWv7x44xHETqqLTV7vo5Q_MKJ2CtwcmZaMuF4ZsdEKy76iGJlStUphdv4dkh2lHIgyD8ZxzzxMb3QWCPeCzbcVlMTTf2Z-4cj1Ocab7Nr3cPl4UQxjQHWPYDESt-1f_j0bIy--ri9VnOWAdazFSsJvBlyQ" },
                                { title: 'Backstage Pass', uri: "https://lh3.googleusercontent.com/aida-public/AB6AXuBxihPgn1C7hK8MeoEiC6aRzQ4QRucV4bx95xIugvoxTmH0N8ipp_rh3mCTzKP_Jbm4Vd7NyulRIrFmOKRYnB8ELeLyQtzrb86bDEskLIzDQN3xebix83pjbJYTbYA6LywAazGv4vFGGekLWx36hLYW63mxm42YqN-f-PwfmDQEY5a-qExZDG6BXgJvzKWJmZ5n_AHczL0ok9_Gp8XtS1R4pI8skRixginXMyt1UYGFUJBymrphclzL06unuweuNiqvWg-_EDSVOMc" },
                            ]).map((item: any, index: number) => (
                                <View key={index} style={styles.portfolioCard}>
                                    <Image source={{ uri: item.uri }} style={styles.portfolioImage} />
                                    <Text style={styles.portfolioTitle}>{item.title ?? item.name ?? `Media ${index+1}`}</Text>
                                </View>
                            ))}
                        </View>
                    </ScrollView>

                    {/* --- Contact --- */}
                    <Text style={[styles.sectionTitle, styles.paddingHorizontal]}>Contact</Text>

                    {renderContactItem(
                        <Text style={{ fontSize: 24 }}>{'@'}</Text>, // Mock Email Icon
                        'Email',
                        artist?.email ?? 'ethan.carter@email.com',
                        artist?.email ? handleEmailPress : undefined
                    )}

                    {renderContactItem(
                        <Text style={{ fontSize: 24 }}>📞</Text>, // Mock Phone Icon
                        'Phone',
                        artist?.phone ?? 'not available',
                        artist?.phone ? () => console.log('Call phone') : undefined
                    )}

                    {renderContactItem(
                        <Text style={{ fontSize: 24 }}>{'#'}</Text>, // Mock Instagram Icon
                        'Instagram',
                        artist?.instagram ?? '@ethan_carter_music',
                        handleInstagramPress
                    )}

                <View style={styles.spacer} />
            </ScrollView>

                {/* --- Sticky Footer Chat Button --- */}
                <View style={styles.footer}>
                    <TouchableOpacity
                        style={styles.chatButton}
                        onPress={handleChatPress}
                        disabled={chatLoading || !artist}
                    >
                        {chatLoading ? (
                            <ActivityIndicator color="#F5F5F5" />
                        ) : (
                            <Text style={styles.chatButtonText}>Chat with Artist</Text>
                        )}
                    </TouchableOpacity>
                    {chatError ? (
                        <Text style={{ color: 'red', marginTop: 8 }}>{chatError}</Text>
                    ) : null}
                </View>
            </View>
        </SafeAreaView>
    );
};

// --- Stylesheet ---
const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#F5F5F5', // Matches neutral-50
    },
    container: {
        flex: 1,
        backgroundColor: '#F5F5F5',
    },
    scrollContent: {
        flexGrow: 1,
        paddingBottom: 20, // Add padding at the bottom for content
    },
    paddingHorizontal: {
        paddingHorizontal: 16,
    },
    centeredMessage: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    // --- Header Styles ---
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        paddingBottom: 8,
        backgroundColor: '#F5F5F5',
    },
    headerIconContainer: {
        width: 48,
        height: 48,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerIconText: {
        fontSize: 24,
        color: '#151414',
    },
    headerCenter: {
        flex: 1,
        alignItems: 'center',
        marginHorizontal: 8,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#151414',
    },
    // --- Hero Image Styles ---
    heroContainer: {
        width: width,
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    heroImage: {
        width: '100%',
        minHeight: 180, // REDUCED from 218 to 180
        height: 180,    // Set fixed height to control size
        borderRadius: 12,
        backgroundColor: '#DDD',
    },
    // --- Info Styles ---
    title: {
        fontSize: 22,
        fontWeight: '800',
        color: '#151414',
        paddingTop: 20,
        paddingBottom: 4, // Reduced bottom padding
    },
    subtitle: {
        color: '#77726e',
        fontSize: 14,
        fontWeight: '400',
        paddingBottom: 12,
    },
    bodyText: {
        color: '#151414',
        fontSize: 16,
        fontWeight: '400',
        lineHeight: 24,
        paddingBottom: 12,
    },
    // --- Portfolio Styles ---
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#151414',
        paddingTop: 16,
        paddingBottom: 8,
    },
    portfolioScroll: {
        paddingVertical: 8,
    },
    portfolioContent: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        gap: 12,
    },
    portfolioCard: {
        width: 150, // REDUCED from width * 0.4 (approx 160) to a fixed 150
        flexDirection: 'column',
        gap: 12, // Reduced gap
        minHeight: 160,
    },
    portfolioImage: {
        width: '100%',
        aspectRatio: 1,
        borderRadius: 12,
        backgroundColor: '#CCC',
    },
    portfolioTitle: {
        color: '#151414',
        fontSize: 15, // Slightly smaller font
        fontWeight: '500',
    },
    // --- Contact Styles ---
    contactItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        minHeight: 64, // Reduced height for more compact items
        paddingVertical: 8,
    },
    contactIconWrapper: {
        width: 44, // Slightly smaller icon wrapper
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 8,
        backgroundColor: '#eeedec',
        marginRight: 16,
    },
    contactTextContainer: {
        flex: 1,
        justifyContent: 'center',
    },
    contactTitle: {
        color: '#151414',
        fontSize: 16,
        fontWeight: '500',
    },
    contactSubtitle: {
        color: '#77726e',
        fontSize: 14,
        fontWeight: '400',
    },
    spacer: {
        height: 100,
    },
    // --- Footer/Chat Button Styles ---
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#F5F5F5',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderTopWidth: 1,
        borderTopColor: '#EEEEEE',
    },
    chatButton: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        height: 48,
        borderRadius: 12,
        backgroundColor: '#6b6057',
    },
    chatButtonText: {
        color: '#F5F5F5',
        fontSize: 16,
        fontWeight: '700',
        letterSpacing: 0.2,
    },
});

export default ArtistProfileScreen;