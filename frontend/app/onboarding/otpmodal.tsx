// OtpModal.js
 
import React, { useState } from 'react';
import {
    Modal,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';

const OtpModal = ({ 
  isVisible,
  onClose,
  onVerify,
  email 
}: {
  isVisible: boolean;
  onClose: () => void;
  onVerify: (otp: string) => void;
  email: string;
}) => {
  const [otp, setOtp] = useState('');

  const handleVerify = () => {
    // Pass the entered OTP to the parent component's verification function
    onVerify(otp);
    setOtp(''); // Clear the OTP input after verification attempt
  };

  return (
    <Modal
      visible={isVisible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          
          <Text style={styles.modalTitle}>Verify Your Email</Text>
          <Text style={styles.modalMessage}>
            We have sent a 6-digit OTP to your email address.
          </Text>
          <TextInput
            style={styles.otpInput}
            placeholder="Enter OTP"
            placeholderTextColor="#A8A29E"
            keyboardType="number-pad"
            maxLength={6}
            value={otp}
            onChangeText={setOtp}
          />
          <TouchableOpacity style={styles.modalButton} onPress={handleVerify}>
            <Text style={styles.modalButtonText}>Verify</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    width: '85%',
  },
  lottieAnimation: {
    width: 150,
    height: 150,
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#16120f',
    marginBottom: 10,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 16,
    color: '#78716C',
    textAlign: 'center',
    marginBottom: 20,
  },
  otpInput: {
    width: '100%',
    height: 56,
    backgroundColor: '#E7E5E4',
    borderRadius: 12,
    paddingHorizontal: 20,
    fontSize: 24,
    color: '#16120f',
    textAlign: 'center',
    marginBottom: 20,
    letterSpacing: 15,
  },
  modalButton: {
    backgroundColor: '#16120f',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 30,
  },
  modalButtonText: {
    color: '#f3ede6',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default OtpModal;