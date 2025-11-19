 
const apiUrl = "http://192.168.0.4:3000/api/";

// This is a cleaner way to manage API endpoints.
 
const apiEndpoints = {
  baseURL: "http://192.168.0.4:3000/api/",
  login: `${apiUrl}auth/login`,
  signup: `${apiUrl}auth/signup/artist`,
  otp: `${apiUrl}auth/otp/send`,  
  verify: `${apiUrl}auth/otp/verify`,
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

