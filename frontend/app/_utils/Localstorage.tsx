import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

const useUserData = () => {
  interface UserData {
    artist_id: string;
    [key: string]: any;
  }
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  const getUserData = async () => {
    try {
      const userDataString = await AsyncStorage.getItem('userData');
      if (userDataString !== null) {
        const userData = JSON.parse(userDataString);
        setUser(userData);
      }
    } catch (e) {
      console.error('Failed to retrieve user data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getUserData();
  }, []);

  return { user, setUser, loading };
};

export default useUserData;
