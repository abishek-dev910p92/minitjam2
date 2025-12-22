 
const apiUrl = "http://192.168.0.3:3000/api/";

// This is a cleaner way to manage API endpoints.
 
const apiEndpoints = {
  baseURL: "http://192.168.0.3:3000/api/",
  login: `${apiUrl}auth/login`,
  signup: `${apiUrl}auth/signup/artist`,
  signupClub: `${apiUrl}auth/signup/club`,
  otp: `${apiUrl}auth/otp/send`,  
  verify: `${apiUrl}auth/otp/verify`,
  forgotPassword: `${apiUrl}auth/password/forgot`,
  resetPassword: `${apiUrl}auth/password/reset`,
  genres: `${apiUrl}genres`,
  // Added search endpoints
  artistSearch: `${apiUrl}artists/search`,
  venueSearch: `${apiUrl}venues/search`,
  // Opportunities (Gigs)
  opportunities: `${apiUrl}opportunities`,
  // Featured venues endpoint
  featuredVenues: `${apiUrl}venues/featured`,
  // Featured artists endpoint
  featuredArtists: `${apiUrl}artists/featured`,
  // Bands endpoints
  bands: `${apiUrl}bands`,
  // Music Stores endpoints
  musicStores: `${apiUrl}music-stores`,
  musicStoresSearch: `${apiUrl}music-stores/search`,
  // Featured Music Stores endpoint
  musicStoresFeatured: `${apiUrl}music-stores/featured`,

  // Chat endpoints
  chat: `${apiUrl}chats`,
  chatConversations: `${apiUrl}chats/conversations`,
  
};

export default apiEndpoints

