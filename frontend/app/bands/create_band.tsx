import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SvgXml } from 'react-native-svg';
import apiEndpoints from '../api/baseUrl';

const ArrowLeftIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24px" height="24px" fill="currentColor" viewBox="0 0 256 256"><path d="M224,128a8,8,0,0,1-8,8H59.31l58.35,58.34a8,8,0,0,1-11.32,11.32l-72-72a8,8,0,0,1,0-11.32l72-72a8,8,0,0,1,11.32,11.32L59.31,120H216A8,8,0,0,1,224,128Z"></path></svg>`;

const PlusIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24px" height="24px" fill="currentColor" viewBox="0 0 256 256"><path d="M224,128a8,8,0,0,1-8,8H136v80a8,8,0,0,1-16,0V136H40a8,8,0,0,1,0-16h80V40a8,8,0,0,1,16,0v80h80A8,8,0,0,1,224,128Z"></path></svg>`;

interface Band {
  band_id: number;
  name: string;
  description: string | null;
  profile_image_url: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  members: Array<{
    user_id: string;
    role: string;
    joined_at: string;
  }>;
}

const CreateBandScreen = () => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Sorry', 'We need camera roll permissions to select a profile image.');
        return;
      }

      // Prefer the newer MediaType when available at runtime to avoid deprecation warnings.
      // Use a runtime lookup and cast to any so TypeScript won't error if the property
      // doesn't exist on the installed version of expo-image-picker.
      const mediaTypesOption = (ImagePicker as any).MediaType?.Images ?? (ImagePicker as any).MediaTypeOptions?.Images ?? (ImagePicker as any).MediaTypeOptions?.Images;

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: mediaTypesOption,
        allowsEditing: true,
        aspect: [3, 2],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]?.uri) {
        setImageUri(result.assets[0].uri);
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const handleCreateBand = async () => {
    if (!name.trim()) {
      setError('Band name is required');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const token = await AsyncStorage.getItem('userToken');
      if (!token) throw new Error('Authentication required');

      const formData = new FormData();
      formData.append('name', name.trim());
      
      if (description.trim()) {
        formData.append('description', description.trim());
      }

      if (imageUri) {
        const filename = imageUri.split('/').pop() || 'image.jpg';
        const match = /\.([\\w\\d_]+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : 'image/jpeg';

        formData.append('file', {
          uri: imageUri,
          name: filename,
          type
        } as any);
      }

      const response = await fetch(apiEndpoints.bands, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Failed to create band (${response.status})`);
      }

      const band = await response.json();
      Alert.alert('Success', 'Band created successfully!');
      
      // Navigate to band details with the full band object
      router.replace({
        pathname: '/bands/band_profile',
        params: { id: band.band_id, band: JSON.stringify(band) }
      });

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create band. Please try again.');
      Alert.alert('Error', 'Failed to create band. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <SvgXml xml={ArrowLeftIcon} width="24" height="24" fill="#16120f" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Band</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Add Profile Picture Section */}
        <TouchableOpacity style={styles.rowItem} onPress={pickImage}>
          <Text style={styles.rowText}>Add Profile Picture</Text>
          <View style={styles.plusIconWrapper}>
            <SvgXml xml={PlusIcon} width="24" height="24" fill="#fff" />
          </View>
        </TouchableOpacity>

        {/* Profile Picture Preview */}
        {imageUri && (
          <View style={styles.imageContainer}>
            <Image
              source={{ uri: imageUri }}
              style={styles.profileImage}
              resizeMode="cover"
            />
          </View>
        )}

        {/* Form */}
        <View style={styles.formSection}>
          {/* Band Name Input */}
          <View style={styles.inputRow}>
            <TextInput
              style={styles.textInput}
              placeholder="Band Name"
              placeholderTextColor="#b1adaa" 
              value={name}
              onChangeText={setName}
            />
          </View>

          {/* Band Description */}
          <View style={styles.inputRow}>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              placeholder="Band Description"
              placeholderTextColor="#b1adaa"
              value={description}
              onChangeText={setDescription}
              multiline
              textAlignVertical="top"
            />
          </View>
        </View>
      </ScrollView>

      {/* Error Message */}
      {error && (
        <Text style={styles.errorText}>{error}</Text>
      )}

      {/* Submit Button */}
      <View style={styles.footerButtonWrapperRow}>
        {/* <TouchableOpacity
          style={[styles.createProfileButton, styles.createAccountButton]}
          onPress={() => router.push('/onboarding')}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonTextAlt}>Create Account</Text>
        </TouchableOpacity> */}

        <TouchableOpacity
          style={[styles.createProfileButton, (!name.trim() || loading) && styles.buttonDisabled]}
          onPress={handleCreateBand}
          disabled={!name.trim() || loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Create Band Account</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3ede6',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3ede6',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 44 : 16,
    paddingBottom: 8,
  },
  backButton: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'flex-start',
    zIndex: 1,
    color: '#16120f',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: '#16120f',
    fontSize: 18,
    fontWeight: 'bold',
  },
  scrollContent: {
    paddingBottom: 20,
  },
  rowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16120f',
    paddingHorizontal: 30,
    minHeight: 56,
    marginVertical: 8,
    marginHorizontal: 16,
    borderRadius: 12,
    justifyContent: 'space-between',
    
  },
  rowText: {
    color: '#f3ede6',
    fontSize: 16,
    fontWeight: 'normal',
    flex: 1,
  },
  plusIconWrapper: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageContainer: {
    padding: 16,
  },
  profileImage: {
    width: '100%',
    aspectRatio: 3 / 2,
    borderRadius: 12,
  },
  inputRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  textInput: {
    flex: 1,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#16120f',
    color: 'white',
    paddingHorizontal: 16,
    fontSize: 16,
    minWidth: '100%',
  },
  textArea: {
    minHeight: 144,
    height: 'auto',
    paddingTop: 16,
    paddingBottom: 16,
  },
  footerButtonWrapper: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1b1918',
    borderTopWidth: 1,
    borderTopColor: '#2b2a29',
  },
  formSection: {
    marginTop: 8,
  },
  createProfileButton: {
    height: 48,
    borderRadius: 12,
    backgroundColor: '#16120f',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  footerButtonWrapperRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f3ede6',
    flexDirection: 'row',
    gap: 12,
  },
  createAccountButton: {
    backgroundColor: '#16120f',
    borderWidth: 1,
    borderColor: '#16120f',
  },
  buttonTextAlt: {
    color: '#6b6057',
    fontSize: 16,
    fontWeight: 'bold',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  errorText: {
    color: '#dc2626',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    marginHorizontal: 16,
  },
});

export default CreateBandScreen;
