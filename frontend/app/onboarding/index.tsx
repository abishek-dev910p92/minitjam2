import { router } from 'expo-router'
import React from 'react'
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native'

const Onboardingfirst = () => {
  return (
    <View style={styles.container}>
      <Image
        source={require('../../assets/images/welcomeimage.png')}
        style={styles.heroImage}
      />
      <View style={styles.contentContainer}>
        <Text style={styles.title}>Welcome to Minit Jam</Text>
        <Text style={styles.subtitle}>Find your next gig with ease</Text>
        <TouchableOpacity 
          style={styles.button} 
          onPress={() => router.push('/onboarding/final')}
        >
          <Text style={styles.buttonText}>Get Started</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

export default Onboardingfirst

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3ede6',
  },
  heroImage: {
    width: '100%',
    height: 300,
    resizeMode: 'cover',
  },
  contentContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 30,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#000',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
})