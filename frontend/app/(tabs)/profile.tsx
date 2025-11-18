import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { Link } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import useUserData from '../_utils/Localstorage';
import usePullToRefresh from '../_utils/usePullToRefresh';
import apiEndpoints from '../api/baseUrl';

import {
    ActivityIndicator,
    FlatList,
    Image,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

const GENRES = [
    { id: 1, name: 'Dancer' },
    { id: 4, name: 'DJ' },
    { id: 6, name: 'musician' },
    { id: 5, name: 'Singer' },
    { id: 3, name: 'Stand-up' },
    { id: 2, name: 'Theater Artist' }
];

// --- Icon Components (Updated for Light Theme) ---
const GearIcon = () => <Svg height="24" width="24" viewBox="0 0 256 256"><Path fill="black" d="M128,80a48,48,0,1,0,48,48A48.05,48.05,0,0,0,128,80Zm0,80a32,32,0,1,1,32-32A32,32,0,0,1,128,160Zm88-29.84q.06-2.16,0-4.32l14.92-18.64a8,8,0,0,0,1.48-7.06,107.21,107.21,0,0,0-10.88-26.25,8,8,0,0,0-6-3.93l-23.72-2.64q-1.48-1.56-3-3L186,40.54a8,8,0,0,0-3.94-6,107.71,107.71,0,0,0-26.25-10.87,8,8,0,0,0-7.06,1.49L130.16,40Q128,40,125.84,40L107.2,25.11a8,8,0,0,0-7.06-1.48A107.6,107.6,0,0,0,73.89,34.51a8,8,0,0,0-3.93,6L67.32,64.27q-1.56,1.49-3,3L40.54,70a8,8,0,0,0-6,3.94,107.71,107.71,0,0,0-10.87,26.25,8,8,0,0,0,1.49,7.06L40,125.84Q40,128,40,130.16L25.11,148.8a8,8,0,0,0-1.48,7.06,107.21,107.21,0,0,0,10.88,26.25,8,8,0,0,0,6,3.93l23.72,2.64q1.49,1.56,3,3L70,215.46a8,8,0,0,0,3.94,6,107.71,107.71,0,0,0,26.25,10.87,8,8,0,0,0,7.06-1.49L125.84,216q2.16.06,4.32,0l18.64,14.92a8,8,0,0,0,7.06,1.48,107.21,107.21,0,0,0,26.25-10.88,8,8,0,0,0,3.93-6l2.64-23.72q1.56-1.48,3-3L215.46,186a8,8,0,0,0,6-3.94,107.71,107.71,0,0,0,10.87-26.25,8,8,0,0,0-1.49-7.06Zm-16.1-6.5a73.93,73.93,0,0,1,0,8.68,8,8,0,0,0,1.74,5.48l14.19,17.73a91.57,91.57,0,0,1-6.23,15L187,173.11a8,8,0,0,0-5.1,2.64,74.11,74.11,0,0,1-6.14,6.14,8,8,0,0,0-2.64,5.1l-2.51,22.58a91.32,91.32,0,0,1-15,6.23l-17.74-14.19a8,8,0,0,0-5-1.75h-.48a73.93,73.93,0,0,1-8.68,0,8,8,0,0,0-5.48,1.74L100.45,215.8a91.57,91.57,0,0,1-15-6.23L82.89,187a8,8,0,0,0-2.64-5.1,74.11,74.11,0,0,1-6.14-6.14,8,8,0,0,0-5.1-2.64L46.43,170.6a91.32,91.32,0,0,1-6.23-15l14.19-17.74a8,8,0,0,0,1.74-5.48,73.93,73.93,0,0,1,0-8.68,8,8,0,0,0-1.74-5.48L40.2,100.45a91.57,91.57,0,0,1,6.23-15L69,82.89a8,8,0,0,0,5.1-2.64,74.11,74.11,0,0,1,6.14-6.14A8,8,0,0,0,82.89,69L85.4,46.43a91.32,91.32,0,0,1,15-6.23l17.74,14.19a8,8,0,0,0,5.48,1.74,73.93,73.93,0,0,1,8.68,0,8,8,0,0,0,5.48-1.74L155.55,40.2a91.57,91.57,0,0,1,15,6.23L173.11,69a8,8,0,0,0,2.64,5.1,74.11,74.11,0,0,1,6.14,6.14,8,8,0,0,0,5.1,2.64l22.58,2.51a91.32,91.32,0,0,1,6.23,15l-14.19,17.74A8,8,0,0,0,199.87,123.66Z" /></Svg>;
const CaretLeftIcon = () => <Svg height="18" width="18" viewBox="0 0 256 256"><Path fill="black" d="M165.66,202.34a8,8,0,0,1-11.32,11.32l-80-80a8,8,0,0,1,0-11.32l80-80a8,8,0,0,1,11.32,11.32L91.31,128Z" /></Svg>;
const CaretRightIcon = () => <Svg height="18" width="18" viewBox="0 0 256 256"><Path fill="black" d="M181.66,133.66l-80,80a8,8,0,0,1-11.32-11.32L164.69,128,90.34,53.66a8,8,0,0,1,11.32-11.32l80,80A8,8,0,0,1,181.66,133.66Z" /></Svg>;
const StarIcon = ({ filled }: { filled?: boolean }) => <Svg height="20" width="20" viewBox="0 0 256 256"><Path fill={filled ? '#FBBF24' : '#D1D5DB'} d="M234.5,114.38l-45.1,39.36,13.51,58.6a16,16,0,0,1-23.84,17.34l-51.11-31-51,31a16,16,0,0,1-23.84-17.34L66.61,153.8,21.5,114.38a16,16,0,0,1,9.11-28.06l59.46-5.15,23.21-55.36a15.95,15.95,0,0,1,29.44,0h0L166,81.17l59.44,5.15a16,16,0,0,1,9.11,28.06Z" /></Svg>;
const ThumbsUpIcon = () => <Svg height="20" width="20" viewBox="0 0 256 256"><Path fill="#6B7280" d="M234,80.12A24,24,0,0,0,216,72H160V56a40,40,0,0,0-40-40,8,8,0,0,0-7.16,4.42L75.06,96H32a16,16,0,0,0-16,16v88a16,16,0,0,0,16,16H204a24,24,0,0,0,23.82-21l12-96A24,24,0,0,0,234,80.12ZM32,112H72v88H32ZM223.94,97l-12,96a8,8,0,0,1-7.94,7H88V105.89l36.71-73.43A24,24,0,0,1,144,56V80a8,8,0,0,0,8,8h64a8,8,0,0,1,7.94,9Z" /></Svg>;
const ThumbsDownIcon = () => <Svg height="20" width="20" viewBox="0 0 256 256"><Path fill="#6B7280" d="M239.82,157l-12-96A24,24,0,0,0,204,40H32A16,16,0,0,0,16,56v88a16,16,0,0,0,16,16H75.06l37.78,75.58A8,8,0,0,0,120,240a40,40,0,0,0,40-40V184h56a24,24,0,0,0,23.82-27ZM72,144H32V56H72Zm150,21.29a7.88,7.88,0,0,1-6,2.71H152a8,8,0,0,0-8,8v24a24,24,0,0,1-19.29,23.54L88,150.11V56H204a8,8,0,0,1,7.94,7l12,96A7.87,7.87,0,0,1,222,165.29Z" /></Svg>;


// --- Helper Data & Components ---
const daysOfWeek = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// Mock booking data (simulated bookings)
const mockBookedDates: { [date: string]: boolean } = {
    // Format: 'YYYY-MM-DD' - showing bookings in different months
    '2024-07-05': true,
    '2024-07-30': true,
    '2024-08-15': true,
    '2024-09-01': true,
    '2024-09-21': true,
};

// Function to check if a specific day in the current month is booked
const isBooked = (year: number, monthIndex: number, day: number) => {
    if (day) {
        // monthIndex is 0-based, padStart ensures '07' for July
        const dateKey = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        return mockBookedDates[dateKey];
    }
    return false;
};

const MusicCard = ({ title, subtitle, imageUrl }: { title: string; subtitle: string; imageUrl: string }) => (
    <View style={styles.musicCard}>
      <Image style={styles.musicImage} source={{ uri: imageUrl }} />
      <View>
        <Text style={styles.textPrimary}>{title}</Text>
        <Text style={styles.textSecondary}>{subtitle}</Text>
      </View>
    </View>
);

const GenreTag = ({ label }: { label: string }) => (
    <View style={styles.genreTag}>
        <Text style={styles.genreTagText}>{label}</Text>
    </View>
);

const TestimonialCard = ({ name, time, review, imageUrl }: { name: string, time: string, review: string, imageUrl: string }) => (
    <View style={styles.testimonialCard}>
        <View style={styles.testimonialHeader}>
            <Image style={styles.testimonialAvatar} source={{ uri: imageUrl }} />
            <View style={{ flex: 1 }}>
                <Text style={styles.textPrimary}>{name}</Text>
                <Text style={styles.textSecondary}>{time}</Text>
            </View>
        </View>
        <View style={styles.starsContainer}>
            <StarIcon filled />
            <StarIcon filled />
            <StarIcon filled />
            <StarIcon filled />
            <StarIcon />
        </View>
        <Text style={styles.aboutText}>{review}</Text>
        <View style={styles.feedbackContainer}>
            <TouchableOpacity style={styles.feedbackButton}>
                <ThumbsUpIcon />
                <Text style={styles.textSecondary}>2</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.feedbackButton}>
                <ThumbsDownIcon />
            </TouchableOpacity>
        </View>
    </View>
);


// --- Main Component ---
export default function ProfileScreen() {
    const { user, setUser } = useUserData();
    // Local state to immediately show a freshly uploaded profile image
    const [displayProfileImage, setDisplayProfileImage] = useState<string | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [isUploadingImage, setIsUploadingImage] = useState(false);
    
    const getAuthToken = async () => {
        try {
            const tokenString = await AsyncStorage.getItem('userToken');
            if (!tokenString) {
                throw new Error('No auth token found');
            }
            return tokenString;
        } catch (e) {
            console.error('Failed to get auth token:', e);
            throw e;
        }
    };

    const uploadImage = async (imageUri: string) => {
        try {
            const token = await getAuthToken();
            if (!token) throw new Error('No auth token');

            // Get the file extension from the URI
            const extension = imageUri.split('.').pop()?.toLowerCase() || 'jpg';
            const mimeType = {
                'jpg': 'image/jpeg',
                'jpeg': 'image/jpeg',
                'png': 'image/png',
                'gif': 'image/gif',
            }[extension] || 'image/jpeg';

            // Define file data type for form data
            type FileData = {
                uri: string;
                type: string;
                name: string;
            };

            // Create form data
            const formData = new FormData();
            const fileData: FileData = {
                uri: Platform.OS === 'android' ? imageUri : imageUri.replace('file://', ''),
                type: mimeType,
                name: `profile-image.${extension}`,
            };
            formData.append('file', fileData as any);

            // Log the image upload request details
            console.log('Image Upload Request:', {
                uri: imageUri,
                fileData,
                headers: {
                    'Accept': 'application/json',
                    'Authorization': 'Bearer [REDACTED]',
                    'Content-Type': 'multipart/form-data'
                }
            });

            // Log the image upload request details with the properly typed file data
            console.log('Image Upload Request:', {
                url: `${apiEndpoints.featuredVenues.replace('venues/featured', '')}media`,
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Authorization': 'Bearer [REDACTED]',
                    'Content-Type': 'multipart/form-data'
                },
                formData: fileData // Use the typed fileData object directly
            });

            const baseApi = apiEndpoints.featuredVenues.replace('venues/featured', '');
            console.log('Upload URL:', `${baseApi}media`);
            
            const response = await fetch(`${baseApi}media`, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data',
                },
                body: formData
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Upload failed with status:', response.status);
                console.error('Response:', errorText);
                try {
                    const errorJson = JSON.parse(errorText);
                    throw new Error(errorJson.message || 'Failed to upload image');
                } catch (e) {
                    throw new Error(`Failed to upload image (${response.status}): ${errorText}`);
                }
            }
            
            const data = await response.json();
            console.log('Upload successful:', data);
            
            // Handle the media URL
            if (!data.media_url) throw new Error('No media URL in response');
            
            // If it's a full URL, use it as is, otherwise treat as relative path
            const mediaUrl = data.media_url.startsWith('http') ? 
                data.media_url : 
                data.media_url.startsWith('/') ? data.media_url : '/' + data.media_url;
                
            console.log('Processed media URL:', mediaUrl);
            return mediaUrl;
        } catch (error) {
            console.error('Image upload error:', error);
            throw error;
        }
    };

    const pickImage = async () => {
        setIsUploadingImage(true);
        try {
            // Request permissions
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                alert('Sorry, we need camera roll permissions to make this work!');
                return;
            }

            // Pick the image
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: 'images',
                allowsEditing: true,
                aspect: [1, 1],
                quality: 1,
            });

                if (!result.canceled) {
                    try {
                        const imageUrl = await uploadImage(result.assets[0].uri);
                        // Immediately show the freshly uploaded image in UI
                        setDisplayProfileImage(imageUrl);
                        if (user) {
                            const updatedUser = { ...((user ?? {}) as any), profile_image_url: imageUrl };
                            setUser(updatedUser);
                            // Update profile via API using the freshly uploaded URL to avoid stale state
                            setEditForm(prev => ({ ...prev, profile_image_url: imageUrl }));
                            await handleUpdateProfile(imageUrl);
                        }
                    } catch (error) {
                        console.error('Error uploading image:', error);
                        // Clear any stale displayProfileImage on error
                        setDisplayProfileImage(null);
                        // Keep existing user data but ensure profile_image_url is up to date
                        const currentUser = user as any;
                        if (currentUser) {
                            setUser({ ...currentUser, profile_image_url: currentUser.profile_image_url });
                        }
                        alert('Failed to upload image. Please try again.');
                    }
                }
        } catch (error) {
            console.error('Error picking image:', error);
            alert('Failed to pick image. Please try again.');
        } finally {
            setIsUploadingImage(false);
        }
    };

    const handleUpdateProfile = async (imageUrlOverride?: string) => {
        try {
            setIsUpdating(true);
            const artistId = (user as any)?.artist_id ?? (user as any)?.id;
            if (!artistId) {
                alert('Unable to update profile: Artist ID not found');
                return;
            }

            const token = await getAuthToken();
            if (!token) {
                alert('Please log in again to update your profile');
                return;
            }

            const baseApi = apiEndpoints.featuredVenues.replace('venues/featured', '');
            const updateData = {
                name: editForm.name,
                phone: editForm.phone,
                bio: editForm.bio,
                genre_id: editForm.genre_id,
                // prefer override (freshly uploaded), otherwise current user value
                profile_image_url: imageUrlOverride ?? (user as any)?.profile_image_url,
            };

            // Log the profile update request details
            console.log('Profile Update Request:', {
                url: `${baseApi}artists/${artistId}`,
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer [REDACTED]'
                },
                body: updateData
            });

            const response = await fetch(`${baseApi}artists/${artistId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify(updateData),
            });

            if (response.ok) {
                const updatedData = await response.json();

                // Determine the final profile image URL that should be shown
                const finalProfileImage = updateData.profile_image_url ?? (user as any)?.profile_image_url ?? null;

                // Create updated user data (include profile_image_url so UI updates instantly)
                const updatedUser = {
                    ...(user as any),
                    name: editForm.name,
                    phone: editForm.phone,
                    bio: editForm.bio,
                    genre_id: editForm.genre_id,
                    profile_image_url: finalProfileImage
                };

                // Update AsyncStorage (merge into stored userData)
                try {
                    const userString = await AsyncStorage.getItem('userData');
                    if (userString) {
                        const userData = JSON.parse(userString);
                        const newUserData = { ...userData, ...updatedUser };
                        await AsyncStorage.setItem('userData', JSON.stringify(newUserData));
                    } else {
                        // No existing userData, write the updated user
                        await AsyncStorage.setItem('userData', JSON.stringify(updatedUser));
                    }
                } catch (error) {
                    console.error('Error updating AsyncStorage:', error);
                }

                // Update all UI state to show new image
                setDisplayProfileImage(finalProfileImage);
                setUser({ ...((user ?? {}) as any), ...updatedUser });
                setIsEditing(false);
                alert('Profile updated successfully');
            } else {
                const errorData = await response.json().catch(() => ({ message: 'Failed to parse error response' }));
                let errorMessage = 'Failed to update profile';
                
                if (errorData?.message) {
                    errorMessage = errorData.message;
                } else if (response.status === 401) {
                    errorMessage = 'Unauthorized. Please log in again.';
                } else if (response.status === 403) {
                    errorMessage = 'You do not have permission to update this profile.';
                } else if (response.status === 400) {
                    errorMessage = errorData.errors?.join(', ') || 'Invalid input data provided.';
                } else if (response.status === 404) {
                    errorMessage = 'Artist profile not found.';
                } else if (response.status >= 500) {
                    errorMessage = 'Server error. Please try again later.';
                }
                
                alert(errorMessage);
            }
        } catch (error) {
            alert('An error occurred while updating profile');
            console.error('Profile update error:', error);
        } finally {
            setIsUpdating(false);
        }
    };
    const [editForm, setEditForm] = useState({
        name: '',
        phone: '',
        bio: '',
        genre_id: ''
    });
    const [showGenreModal, setShowGenreModal] = useState(false);

    // Initialize edit form when user data is available
    useEffect(() => {
        if (user) {
            setEditForm({
                name: (user as any)?.name || '',
                phone: (user as any)?.phone || '',
                bio: (user as any)?.bio || '',
                genre_id: (user as any)?.genre_id || ''
            });
        }
    }, [user]);

    // State to manage the currently displayed month/year (starts at current date)
    const [currentDate, setCurrentDate] = useState(new Date());

    // Calculate calendar details based on currentDate
    const { monthName, year, totalDays, firstDayOfMonth, monthIndex } = useMemo(() => {
        const date = currentDate;
        const monthIndex = date.getMonth();
        const year = date.getFullYear();

        // Get the last day of the current month
        const totalDays = new Date(year, monthIndex + 1, 0).getDate();

        // Get the day of the week (0=Sunday, 6=Saturday) for the 1st of the month
        const firstDayOfMonth = new Date(year, monthIndex, 1).getDay();

        return {
            monthName: months[monthIndex],
            year,
            totalDays,
            firstDayOfMonth,
            monthIndex,
        };
    }, [currentDate]);

    // Function to navigate to the previous or next month
    const changeMonth = (direction: 'prev' | 'next') => {
        setCurrentDate((prevDate) => {
            const newDate = new Date(prevDate.getTime());
            // This is the correct way to navigate months in JavaScript Date objects
            newDate.setMonth(prevDate.getMonth() + (direction === 'next' ? 1 : -1));
            return newDate;
        });
    };

    // Prepare all days for the calendar grid
    const calendarDays = useMemo(() => {
        const days: (number | '')[] = [];
        // Add empty placeholders for the days before the 1st of the month
        for (let i = 0; i < firstDayOfMonth; i++) {
            days.push('');
        }
        // Add the actual days of the month
        for (let i = 1; i <= totalDays; i++) {
            days.push(i);
        }
        return days;
    }, [totalDays, firstDayOfMonth]);

        // Booking state: keep richer booking info and allow saving from modal
        const [bookings, setBookings] = useState<Record<string, { title?: string; description?: string }>>(() => {
            const initial: Record<string, { title?: string; description?: string }> = {};
            Object.keys(mockBookedDates).forEach(k => {
                if (mockBookedDates[k]) initial[k] = { title: 'Booked', description: '' };
            });
            return initial;
        });

        const [isBookingModalVisible, setBookingModalVisible] = useState(false);
        const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
        const [bookingTitle, setBookingTitle] = useState('');
        const [bookingDescription, setBookingDescription] = useState('');

        const openBookingModal = (year: number, monthIndex: number, day: number) => {
            if (!day) return;
            const dateKey = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            setSelectedDateKey(dateKey);
            const existing = bookings[dateKey];
            setBookingTitle(existing?.title ?? '');
            setBookingDescription(existing?.description ?? '');
            setBookingModalVisible(true);
        };

        const saveBooking = () => {
            if (!selectedDateKey) return;
            setBookings(prev => ({ ...prev, [selectedDateKey]: { title: bookingTitle || 'Booked', description: bookingDescription || '' } }));
            setBookingModalVisible(false);
        };

        const cancelBooking = () => {
            setSelectedDateKey(null);
            setBookingTitle('');
            setBookingDescription('');
            setBookingModalVisible(false);
        };

    // Fetch upcoming gigs for the logged-in user and mark those dates as booked
    useEffect(() => {
        if (!(user as any)) return;
        let cancelled = false;
        const controller = new AbortController();
        const fetchUpcoming = async () => {
            try {
                const artistId = (user as any)?.artist_id ?? (user as any)?.id ?? 45;
                const baseApi = apiEndpoints.featuredVenues.replace('venues/featured', '');
                const url = `${baseApi}artists/${artistId}/gigs?page=1&per_page=50`;
                const res = await fetch(url, { signal: controller.signal });
                if (!res.ok) return;
                const json = await res.json();
                const items = Array.isArray(json) ? json : (json?.items ?? json?.data ?? []);
                // Map event dates into bookings
                const newBookings: Record<string, { title?: string; description?: string }> = {};
                for (const it of items) {
                    try {
                        const d = new Date(it.event_date);
                        if (isNaN(d.getTime())) continue;
                        const yyyy = d.getFullYear();
                        const mm = String(d.getMonth() + 1).padStart(2, '0');
                        const dd = String(d.getDate()).padStart(2, '0');
                        const key = `${yyyy}-${mm}-${dd}`;
                        newBookings[key] = { title: it.title ?? 'Gig', description: it.description ?? '' };
                    } catch (err) {
                        // ignore malformed dates
                      }
                }
                if (!cancelled && Object.keys(newBookings).length > 0) {
                    setBookings(prev => ({ ...prev, ...newBookings }));
                }
            } catch (e: any) {
                if (e?.name === 'AbortError') return;
            }
        };
        fetchUpcoming();
        return () => { cancelled = true; controller.abort(); };
    }, [user]);


    // pull-to-refresh for profile: re-fetch user-related data
    const { refreshControl } = usePullToRefresh({
        onRefresh: async () => {
            // re-load user from storage or API (best-effort)
            try {
                // If useUserData exposes a reload, call it. Otherwise, re-read AsyncStorage
                const raw = await AsyncStorage.getItem('user');
                if (raw) setUser(JSON.parse(raw));
            } catch (e) {
                // ignore
            }
        }
    });

    return (
    <SafeAreaView style={styles.safeArea}>
        <ScrollView refreshControl={refreshControl}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Profile</Text>
                <Link href="/settings" asChild>
                    <TouchableOpacity style={styles.headerIcon}>
                        <GearIcon />
                    </TouchableOpacity>
                </Link>
                </View>

                {/* Profile Info */}
                <View style={styles.profileInfoContainer}>
                    <TouchableOpacity onPress={pickImage} disabled={isUploadingImage}>
                        {(displayProfileImage ?? (user as any)?.profile_image_url) ? (
                            <Image 
                                style={styles.profileAvatar} 
                                source={{ 
                                    uri: ((displayProfileImage ?? (user as any)?.profile_image_url) || '').toString().startsWith('http') ?
                                        (displayProfileImage ?? (user as any)?.profile_image_url) :
                                        `${apiEndpoints.featuredVenues.replace('venues/featured', '')}${(displayProfileImage ?? (user as any)?.profile_image_url)}`
                                }}
                                onError={(error) => {
                                    // Build a resolved URL for logging without double-prefixing
                                    const raw = displayProfileImage ?? (user as any)?.profile_image_url;
                                    const resolved = raw ? (raw.toString().startsWith('http') ? raw : `${apiEndpoints.featuredVenues.replace('venues/featured', '')}${raw}`) : raw;
                                    // Safely stringify the error to avoid throwing non-Error objects to Metro
                                    let errMsg = 'Unknown image error';
                                    try {
                                        const maybe = error?.nativeEvent?.error ?? error?.nativeEvent ?? error;
                                        errMsg = typeof maybe === 'string' ? maybe : JSON.stringify(maybe);
                                    } catch (e) {
                                        errMsg = String(error);
                                    }
                                    console.error(`Error loading profile image: ${errMsg} | attempted: ${resolved}`);
                                    // Fallback to placeholder on error
                                    try {
                                        setDisplayProfileImage(null);
                                        setUser({ ...((user ?? {}) as any), profile_image_url: null });
                                    } catch (e) {
                                        console.error('Failed to update user state after image error', String(e));
                                    }
                                }}
                            />
                        ) : (
                            <View style={[styles.profileAvatar, styles.profileAvatarPlaceholder]}>
                                <Text style={styles.profileAvatarPlaceholderText}>Add Photo</Text>
                            </View>
                        )}
                        <View style={styles.editAvatarButton}>
                            {isUploadingImage ? (
                                <ActivityIndicator color="#FFFFFF" size="small" />
                            ) : (
                                <Text style={styles.editAvatarText}>Edit</Text>
                            )}
                        </View>
                    </TouchableOpacity>
                    {!isEditing ? (
                        <>
                            <Text style={styles.profileName}>{(user as any)?.name || 'Loading'}</Text>
                             <View style={styles.genreContainer}>
                    {(user as any)?.genre_id && (
                        <GenreTag label={GENRES.find(g => g.id === parseInt((user as any)?.genre_id))?.name || 'Unknown'} />
                    )}
                </View>
                            <Text style={styles.textSecondary}>+91 {(user as any)?.phone || 'Loading'}</Text>
                            <Text style={styles.textSecondary}>{(user as any)?.email || 'Loading'}</Text>
                            <TouchableOpacity onPress={() => setIsEditing(true)} style={styles.editButton}>
                                <Text style={styles.editButtonText}>Edit Profile</Text>
                            </TouchableOpacity>
                        </>
                    ) : (
                        <>
                            <TextInput
                                value={editForm.name}
                                onChangeText={(text) => setEditForm(prev => ({ ...prev, name: text }))}
                                style={styles.editInput}
                                placeholder="Name"
                            />
                            <TextInput
                                value={editForm.bio}
                                onChangeText={(text) => setEditForm(prev => ({ ...prev, bio: text }))}
                                style={[styles.editInput, styles.editInputMultiline]}
                                placeholder="Bio"
                                multiline
                            />
                            <TextInput
                                value={editForm.phone}
                                onChangeText={(text) => setEditForm(prev => ({ ...prev, phone: text }))}
                                style={styles.editInput}
                                placeholder="Phone"
                                keyboardType="phone-pad"
                            />
                            <TouchableOpacity 
                                style={[styles.editInput, styles.genreSelector]} 
                                onPress={() => setShowGenreModal(true)}
                            >
                                <Text style={styles.genreText}>
                                    {GENRES.find(g => g.id.toString() === editForm.genre_id)?.name || 'Select Genre'}
                                </Text>
                                <Svg height="20" width="20" viewBox="0 0 256 256">
                                    <Path fill="#6B7280" d="M213.66,101.66l-80,80a8,8,0,0,1-11.32,0l-80-80A8,8,0,0,1,53.66,90.34L128,164.69l74.34-74.35a8,8,0,0,1,11.32,11.32Z" />
                                </Svg>
                            </TouchableOpacity>
                            <View style={styles.editButtonsRow}>
                                <TouchableOpacity 
                                    onPress={() => {
                                        setIsEditing(false);
                                        // Reset displayProfileImage to match persisted state
                                        setDisplayProfileImage((user as any)?.profile_image_url ?? null);
                                    }} 
                                    style={[styles.editButton, styles.cancelButton]}
                                >
                                    <Text style={[styles.editButtonText, styles.cancelButtonText]}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity 
                                    onPress={() => handleUpdateProfile()} 
                                    style={[styles.editButton, styles.saveButton, isUpdating && styles.disabledButton]}
                                    disabled={isUpdating}
                                >
                                    <Text style={[styles.editButtonText, styles.saveButtonText]}>
                                        {isUpdating ? 'Updating...' : 'Save'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </>
                    )}
                </View>

                {/* Music Section */}
                {/* <Text style={styles.sectionTitle}>Media</Text>
                   <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScroll}>
                       <MusicCard title="Folk Favorites" subtitle="Spotify Playlist" imageUrl="https://picsum.photos/seed/music1/200" />
                       <MusicCard title="Rock Anthems" subtitle="SoundCloud Playlist" imageUrl="https://picsum.photos/seed/music2/200" />
                       <MusicCard title="Bluesy Grooves" subtitle="Bandcamp Album" imageUrl="https://picsum.photos/seed/music3/200" />
                   </ScrollView> */}

                {/* About Section */}
                <Text style={styles.sectionTitle}>About</Text>
                 
                <Text style={styles.aboutText}>
                    {(() => {
                        const userData = user as any;
                        if (!userData) return 'No bio available';

                        // Helper to build a concise ~20-word summary with CTA
                        const generateProfileSummary = (u: any) => {
                            const name = u?.name ? String(u.name).trim() : '';
                            const genre = GENRES.find(g => g.id === Number(u?.genre_id))?.name || 'artist';
                            const bio = u?.bio ? String(u.bio).trim() : '';

                            // Base pieces to include
                            const parts: string[] = [];
                            if (name) parts.push(name);
                            parts.push('is a');
                            parts.push(genre);

                            // If bio has useful first phrase, use it as highlight
                            if (bio) {
                                // take first clause or sentence and limit length
                                const firstClause = bio.split(/[.\n]/)[0].trim();
                                if (firstClause) {
                                    const truncated = firstClause.split(' ').slice(0, 10).join(' ');
                                    parts.push('-', truncated);
                                }
                            }

                            // Add a short CTA inviting bookings / live events
                            parts.push('. Available for live shows & events — book now!');

                            // Join and then trim to ~20 words
                            const joined = parts.join(' ')
                                .replace(/\s+/g, ' ')
                                .trim();

                            const words = joined.split(' ');
                            if (words.length <= 20) return joined;
                            return words.slice(0, 20).join(' ') + '...';
                        };

                        return generateProfileSummary(userData);
                    })()}
                </Text>
                {/* Availability Calendar (Now Interactive) */}
                <Text style={styles.sectionTitle}>Availability</Text>
                <View style={styles.calendarWrapper}>
                    <View style={styles.calendarHeader}>
                        {/* Interactive Month Navigation */}
                        <TouchableOpacity onPress={() => changeMonth('prev')}><CaretLeftIcon /></TouchableOpacity>
                        <Text style={styles.calendarMonthText}>{monthName} {year}</Text>
                        <TouchableOpacity onPress={() => changeMonth('next')}><CaretRightIcon /></TouchableOpacity>
                    </View>
                    <View style={styles.calendarGrid}>
                        {daysOfWeek.map((day, index) => (
                            <View key={index} style={styles.dayCell}>
                                <Text style={styles.dayHeaderText}>{day}</Text>
                            </View>
                        ))}
                        {/* Render dynamic calendar days with booked indicator */}
                        {calendarDays.map((day, index) => {
                            // Check if the date is booked (from initial mock or saved bookings)
                            const dateKey = day !== '' ? `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` : null;
                            const isBookedDay = !!dateKey && (mockBookedDates[dateKey] || !!bookings[dateKey]);
                            return (
                                <TouchableOpacity key={index} onPress={() => dateKey && openBookingModal(year, monthIndex, day as number)} style={[
                                    styles.dayCell, 
                                    isBookedDay && styles.dayCellAvailable // Apply style for booked dates
                                ]}>
                                    <Text style={styles.dayText}>{day}</Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>

                {/* Testimonials Section */}
                {/* <Text style={styles.sectionTitle}>Testimonials</Text>
                <View style={{ paddingHorizontal: 16 }}>
                    <TestimonialCard
                         name="Liam O'Connell"
                         time="2 months ago"
                         review="Ethan's performance was outstanding! His energy and talent truly engaged our audience. Highly recommend for any event."
                         imageUrl="https://picsum.photos/seed/user1/100"
                     />
                     <TestimonialCard
                         name="Sophie Dubois"
                         time="6 months ago"
                         review="Ethan is a skilled musician with a great stage presence. Our patrons enjoyed his music, and he was professional to work with."
                         imageUrl="https://picsum.photos/seed/user2/100"
                     />
                 </View> */}

            </ScrollView>
            {/* Booking Modal */}
            {/* <Modal animationType="slide" transparent={true} visible={isBookingModalVisible} onRequestClose={cancelBooking}>
                <View style={styles.modalOverlay}>
                    <View style={styles.bookingModal}>
                        <Text style={styles.modalTitleText}>{selectedDateKey}</Text>
                        <TextInput placeholder="Title" value={bookingTitle} onChangeText={setBookingTitle} style={styles.inputSimple} />
                        <TextInput placeholder="Description" value={bookingDescription} onChangeText={setBookingDescription} style={[styles.inputSimple, { height: 80 }]} multiline />
                        <View style={styles.modalButtonsRow}>
                            <TouchableOpacity onPress={cancelBooking} style={styles.modalButtonSecondary}>
                                <Text style={styles.modalButtonText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={saveBooking} style={styles.modalButtonPrimary}>
                                <Text style={[styles.modalButtonText, { color: '#fff' }]}>Save</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal> */}
            
            {/* Genre Selection Modal */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={showGenreModal}
                onRequestClose={() => setShowGenreModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.bookingModal}>
                        <Text style={styles.modalTitleText}>Select Genre</Text>
                        <FlatList
                            data={GENRES}
                            keyExtractor={(item) => item.id.toString()}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={[
                                        styles.genreOption,
                                        item.id.toString() === editForm.genre_id && styles.selectedGenre
                                    ]}
                                    onPress={() => {
                                        setEditForm(prev => ({ ...prev, genre_id: item.id.toString() }));
                                        setShowGenreModal(false);
                                    }}
                                >
                                    <Text style={[
                                        styles.genreOptionText,
                                        item.id.toString() === editForm.genre_id && styles.selectedGenreText
                                    ]}>
                                        {item.name}
                                    </Text>
                                </TouchableOpacity>
                            )}
                        />
                        <TouchableOpacity
                            style={styles.modalButtonSecondary}
                            onPress={() => setShowGenreModal(false)}
                        >
                            <Text style={styles.modalButtonText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

             {/* Footer */}
             <View style={styles.spacer} />
        </SafeAreaView>

    );
}

// --- Stylesheet ---
const styles = StyleSheet.create({
    editAvatarButton: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        backgroundColor: '#111827',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
    },
    editAvatarText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '600',
    },
    profileAvatarPlaceholder: {
        backgroundColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
    },
    profileAvatarPlaceholderText: {
        color: '#6B7280',
        fontSize: 14,
        fontWeight: '500',
    },
    safeArea: {
        flex: 1,
        backgroundColor: '#f3ede6',
    },
    editInput: {
        width: '100%',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 8,
        padding: 12,
        marginVertical: 4,
        backgroundColor: '#FFFFFF',
        color: '#111827',
    },
    editInputMultiline: {
        height: 80,
        textAlignVertical: 'top',
    },
    editButton: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 8,
        marginTop: 8,
        backgroundColor: '#111827',
    },
    editButtonText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
    },
    editButtonsRow: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 8,
        width: '100%',
    },
    cancelButton: {
        backgroundColor: '#E5E7EB',
        flex: 1,
        borderWidth: 1,
        borderColor: '#D1D5DB',
    },
    saveButton: {
        flex: 1,
    },
    cancelButtonText: {
        color: '#111827',
    },
    saveButtonText: {
        color: '#FFFFFF',
    },
    disabledButton: {
        opacity: 0.6,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    headerTitle: {
        flex: 1,
        textAlign: 'center',
        color: '#111827',
        fontSize: 18,
        fontWeight: 'bold',
        paddingLeft: 48,
    },
    headerIcon: {
        width: 48,
        height: 48,
        justifyContent: 'center',
        alignItems: 'flex-end',
    },
    profileInfoContainer: {
        alignItems: 'center',
        padding: 16,
        gap: 4,
    },
    profileAvatar: {
        width: 128,
        height: 128,
        borderRadius: 64,
        marginBottom: 12,
    },
    profileName: {
        color: '#111827',
        fontSize: 22,
        fontWeight: 'bold',
    },
    spacer:{
        marginBottom:85
    },
    sectionTitle: {
        color: '#111827',
        fontSize: 18,
        fontWeight: 'bold',
        paddingHorizontal: 16,
        marginTop: 16,
        marginBottom: 8,
    },
    horizontalScroll: {
        paddingHorizontal: 16,
        gap: 12,
    },
    musicCard: {
        width: 240,
        gap: 8,
    },
    musicImage: {
        width: '100%',
        aspectRatio: 1,
        borderRadius: 12,
    },
    aboutText: {
        color: '#374151',
        fontSize: 16,
        lineHeight: 24,
        paddingHorizontal: 16,
        textAlign: 'justify',
        fontStyle: 'italic',
        letterSpacing: 0.3,
    },
    genreContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        paddingHorizontal: 16,
    },
    genreTag: {
        height: 32,
        backgroundColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 16,
        paddingHorizontal: 16,
    },
    genreTagText: {
        color: '#374151',
        fontWeight: '500',
    },
    calendarWrapper: {
        paddingHorizontal: 16,
    },
    calendarHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    calendarMonthText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#111827',
    },
    calendarGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    bookingModal: {
        width: '90%',
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
    },
    modalTitleText: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 8,
        textAlign: 'center',
    },
    inputSimple: {
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 8,
        padding: 8,
        marginBottom: 8,
        backgroundColor: '#FAFAFA',
    },
    modalButtonsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 8,
        marginTop: 8,
    },
    modalButtonSecondary: {
        flex: 1,
        padding: 12,
        borderRadius: 8,
        backgroundColor: '#F3F4F6',
        alignItems: 'center',
    },
    modalButtonPrimary: {
        flex: 1,
        padding: 12,
        borderRadius: 8,
        backgroundColor: '#111827',
        alignItems: 'center',
    },
    modalButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111827',
    },
    dayCell: {
        width: `${100 / 7}%`,
        height: 48,
        justifyContent: 'center',
        alignItems: 'center',
    },
    dayHeaderText: {
        color: '#6B7280',
        fontWeight: 'bold',
        fontSize: 13,
    },
    dayText: {
        color: '#111827',
        fontSize: 14,
    },
    // Style for a booked/busy date
    dayCellAvailable: {
        backgroundColor: '#FBBF24', // Indicating a booked day
        borderRadius: 24,
    },
    testimonialCard: {
        gap: 12,
        marginBottom: 24,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
    },
    testimonialHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    testimonialAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
    },
    starsContainer: {
        flexDirection: 'row',
        gap: 2,
    },
    feedbackContainer: {
        flexDirection: 'row',
        gap: 36,
    },
    feedbackButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    textPrimary: {
        color: '#111827',
        fontSize: 16,
        fontWeight: '500',
    },
    textSecondary: {
        color: '#6B7280',
        fontSize: 14,
    },
    genreSelector: {
        justifyContent: 'space-between',
        flexDirection: 'row',
        alignItems: 'center',
        height: 48,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#D1D5DB',
        borderRadius: 8,
        paddingHorizontal: 12,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.15,
        shadowRadius: 3,
        elevation: 2,
    },
    genreText: {
        color: '#111827',
        fontSize: 16,
        flex: 1,
    },
    genreOption: {
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    selectedGenre: {
        backgroundColor: '#F3F4F6',
    },
    genreOptionText: {
        fontSize: 16,
        color: '#111827',
    },
    selectedGenreText: {
        color: '#000000',
        fontWeight: 'bold',
    },
});