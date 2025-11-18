// Test script to verify chat API functionality
const axios = require('axios');

const API_BASE = 'http://localhost:3000/api';

async function testChatAPI() {
  try {
    console.log('Testing chat API endpoints...');
    
    // Test conversation endpoint without auth (should fail)
    console.log('\n1. Testing conversation endpoint without auth:');
    try {
      const response = await axios.get(`${API_BASE}/chats/conversations`);
      console.log('❌ Unexpected success:', response.status);
    } catch (error) {
      console.log('✅ Correctly rejected unauthorized request:', error.response?.status);
    }
    
    // Test conversation endpoint with invalid auth (should fail)
    console.log('\n2. Testing conversation endpoint with invalid auth:');
    try {
      const response = await axios.get(`${API_BASE}/chats/conversations`, {
        headers: { Authorization: 'Bearer invalid_token' }
      });
      console.log('❌ Unexpected success:', response.status);
    } catch (error) {
      console.log('✅ Correctly rejected invalid token:', error.response?.status);
    }
    
    // Test get conversation with missing parameters (should fail)
    console.log('\n3. Testing get conversation with missing parameters:');
    try {
      const response = await axios.get(`${API_BASE}/chats`);
      console.log('❌ Unexpected success:', response.status);
    } catch (error) {
      console.log('✅ Correctly rejected missing parameters:', error.response?.status);
      console.log('Error response:', error.response?.data);
    }
    
    // Test get conversation with valid parameters (should work)
    console.log('\n4. Testing get conversation with valid parameters:');
    try {
      const params = new URLSearchParams({
        sender_type: 'artist',
        sender_id: '1',
        receiver_type: 'club',
        receiver_id: '1',
        page: '1',
        per_page: '10'
      });
      
      const response = await axios.get(`${API_BASE}/chats?${params}`);
      console.log('✅ Successfully retrieved conversation:', response.status);
      console.log('Response data:', JSON.stringify(response.data, null, 2));
    } catch (error) {
      console.log('❌ Failed to retrieve conversation:', error.response?.status);
      console.log('Error response:', error.response?.data);
    }
    
    console.log('\n✅ Chat API testing completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testChatAPI();