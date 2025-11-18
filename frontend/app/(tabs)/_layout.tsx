import { Icons } from '@/constants/icons';
import { Images } from '@/constants/image';
import { ImageBackground } from 'expo-image';
import { Tabs } from 'expo-router';
import React, { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNotificationStore } from '../../utils/notificationStore';

// Move static styles outside
const styles = StyleSheet.create({
  focusedContainer: {
    width: '400%',
    
    minHeight: 60, // reduced from 340 for tab bar
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 50,
    overflow: 'hidden',
  },
  focusedText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  defaultIconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 4,
  },
});

// Memoize TabIcon to avoid unnecessary re-renders
const TabIcon = memo(({ focused, icon: Icon, title, badgeCount = 0 }: any) => {
  const color = focused ? '#fff' : '#000';

  if (focused) {
    return (
      <ImageBackground
        source={Images.tabBg}
        style={styles.focusedContainer}
        imageStyle={{ borderRadius: 20 }}
      >
        <View style={{ position: 'relative' }}>
          <Icon color={color} />
          {badgeCount > 0 ? (
            <View style={{ position: 'absolute', top: -6, right: -10, backgroundColor: '#ef4444', borderRadius: 9999, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}>
              <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>{badgeCount > 99 ? '99+' : String(badgeCount)}</Text>
            </View>
          ) : null}
        </View>
        <Text style={[styles.focusedText, { color }]}>{title}</Text>
      </ImageBackground>
    );
  }

  return (
    <View style={styles.defaultIconContainer}>
      <View style={{ position: 'relative' }}>
        <Icon color={color} />
        {badgeCount > 0 ? (
          <View style={{ position: 'absolute', top: -6, right: -10, backgroundColor: '#ef4444', borderRadius: 9999, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}>
            <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>{badgeCount > 99 ? '99+' : String(badgeCount)}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
});

// Give memoized component a display name for eslint/react
TabIcon.displayName = 'TabIcon';

const Layout = () => {
  const totalUnread = useNotificationStore((s) => s.totalUnread);
  return (
    <Tabs
      screenOptions={{
        tabBarItemStyle: {
          width: '100%',
          height: '100%',
          justifyContent: 'center',
          alignItems: 'center',
          marginTop: 4,
          paddingLeft: 25,
          paddingRight: 20,
        },
        tabBarStyle: {
          backgroundColor: '#fff',
          marginBottom: 20,
          borderRadius: 20,
          marginHorizontal: 10,
          height: 45,
          position: 'absolute',
          zIndex: 100,
          
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          headerShown: false,
          tabBarShowLabel: false,
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} icon={Icons.home} title="Home" />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
          headerShown: false,
          tabBarShowLabel: false,
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} icon={Icons.magnifier} title="Search" />
          ),
        }}
      />
      <Tabs.Screen
        name="message"
        options={{
          title: 'Chat',
          headerShown: false,
          tabBarShowLabel: false,
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} icon={Icons.message} title="Chat" badgeCount={totalUnread} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          headerShown: false,
          tabBarShowLabel: false,
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} icon={Icons.star} title="Profile" />
          ),
        }}
      />
    </Tabs>
  );
};

export default Layout;
