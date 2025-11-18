import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SvgXml } from 'react-native-svg';
import usePullToRefresh from './_utils/usePullToRefresh';
const ArrowLeftIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24px" height="24px" fill="currentColor" viewBox="0 0 256 256"><path d="M224,128a8,8,0,0,1-8,8H59.31l58.35,58.34a8,8,0,0,1-11.32,11.32l-72-72a8,8,0,0,1,0-11.32l72-72a8,8,0,0,1,11.32,11.32L59.31,120H216A8,8,0,0,1,224,128Z"></path></svg>`;
const CaretDownIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="20px" height="20px" fill="currentColor" viewBox="0 0 256 256"><path d="M213.66,101.66l-80,80a8,8,0,0,1-11.32,0l-80-80A8,8,0,0,1,53.66,90.34L128,164.69l74.34-74.35a8,8,0,0,1,11.32,11.32Z"></path></svg>`;
const EnvelopeIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24px" height="24px" fill="currentColor" viewBox="0 0 256 256"><path d="M224,48H32a8,8,0,0,0-8,8V192a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V56A8,8,0,0,0,224,48Zm-96,85.15L52.57,64H203.43ZM98.71,128,40,181.81V74.19Zm11.84,10.85,12,11.05a8,8,0,0,0,10.82,0l12-11.05,58,53.15H52.57ZM157.29,128,216,74.18V181.82Z"></path></svg>`;
const PhoneIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24px" height="24px" fill="currentColor" viewBox="0 0 256 256"><path d="M222.37,158.46l-47.11-21.11-.13-.06a16,16,0,0,0-15.17,1.4,8.12,8.12,0,0,0-.75.56L134.87,160c-15.42-7.49-31.34-23.29-38.83-38.51l20.78-24.71c.2-.25.39-.5.57-.77a16,16,0,0,0,1.32-15.06l0-.12L97.54,33.64a16,16,0,0,0-16.62-9.52A56.26,56.26,0,0,0,32,80c0,79.4,64.6,144,144,144a56.26,56.26,0,0,0,55.88-48.92A16,16,0,0,0,222.37,158.46ZM176,208A128.14,128.14,0,0,1,48,80,40.2,40.2,0,0,1,82.87,40a.61.61,0,0,0,0,.12l21,47L83.2,111.86a6.13,6.13,0,0,0-.57.77,16,16,0,0,0-1,15.7c9.06,18.53,27.73,37.06,46.46,46.11a16,16,0,0,0,15.75-1.14,8.44,8.44,0,0,0,.74-.56L168.89,152l47,21.05h0s.08,0,.11,0A40.21,40.21,0,0,1,176,208Z"></path></svg>`;
const FileTextIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24px" height="24px" fill="currentColor" viewBox="0 0 256 256"><path d="M213.66,82.34l-56-56A8,8,0,0,0,152,24H56A16,16,0,0,0,40,40V216a16,16,0,0,0,16,16H200a16,16,0,0,0,16-16V88A8,8,0,0,0,213.66,82.34ZM160,51.31,188.69,80H160ZM200,216H56V40h88V88a8,8,0,0,0,8,8h48V216Zm-32-80a8,8,0,0,1-8,8H96a8,8,0,0,1,0-16h64A8,8,0,0,1,168,136Zm0,32a8,8,0,0,1-8,8H96a8,8,0,0,1,0-16h64A8,8,0,0,1,168,168Z"></path></svg>`;

const faqData = [
  {
    question: "How do I book a venue?",
    answer: "To book a venue, navigate to the 'Venues' tab, select your desired location and date, and follow the prompts to complete your booking.",
  },
  {
    question: "What are the payment options?",
    answer: "We accept all major credit cards, as well as digital payment methods like Apple Pay and Google Pay. You can also pay via bank transfer for larger bookings.",
  },
  {
    question: "Can I cancel my booking?",
    answer: "Yes, you can cancel your booking through the app. Please refer to our cancellation policy for any fees that may apply.",
  },
];

const contactData = [
  { text: "Email Us", icon: EnvelopeIcon },
  { text: "Call Us", icon: PhoneIcon },
 
];

const FAQItem = ({ question, answer, isOpen }: { question: string; answer: string; isOpen: boolean }) => {
  const [isExpanded, setIsExpanded] = React.useState(isOpen);
  return (
    <View style={styles.faqItemContainer}>
      <TouchableOpacity onPress={() => setIsExpanded(!isExpanded)} style={styles.faqSummary}>
        <Text style={styles.faqQuestion}>{question}</Text>
        <View style={[styles.faqCaret, isExpanded && styles.faqCaretRotated]}>
          <SvgXml xml={CaretDownIcon} width="20" height="20" fill="#FFFFFF" />
        </View>
      </TouchableOpacity>
      {isExpanded && <Text style={styles.faqAnswer}>{answer}</Text>}
    </View>
  );
};

const ContactItem = ({ text, icon }: { text: string; icon: string }) => (
  <TouchableOpacity style={styles.contactItem}>
    <Text style={styles.contactText}>{text}</Text>
    <View style={styles.contactIcon}>
      <SvgXml xml={icon} width="24" height="24" fill="#16120f" />
    </View>
  </TouchableOpacity>
);

const HelpAndSupportScreen = () => {
 

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerIcon}>
            <SvgXml xml={ArrowLeftIcon} width="24" height="24" fill="#16120f" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Help & Support</Text>
        </View>

  <ScrollView contentContainerStyle={styles.scrollViewContent} refreshControl={usePullToRefresh().refreshControl}>
          {/* FAQ Section */}
          <Text style={styles.sectionHeader}>Frequently Asked Questions</Text>
          <View style={styles.faqList}>
            {faqData.map((item, index) => (
              <FAQItem key={index} question={item.question} answer={item.answer} isOpen={index === 0} />
            ))}
          </View>

          {/* Contact Support Section */}
          <Text style={styles.sectionHeader}>Contact Support</Text>
          <View>
            {contactData.map((item, index) => (
              <ContactItem key={index} text={item.text} icon={item.icon} />
            ))}
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f3ede6',
  },
  container: {
    flex: 1,
    backgroundColor: '#f3ede6',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 8,
  },
  headerIcon: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontFamily: 'Manrope-700',
    color: '#16120f',
    textAlign: 'center',
    paddingRight: 48,
  },
  scrollViewContent: {
    paddingBottom: 20,
  },
  sectionHeader: {
    fontSize: 16,
    fontFamily: 'Manrope-700',
    color: '#16120f',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 12,
  },
  faqList: {
    paddingHorizontal: 16,
    gap: 12,
  },
  faqItemContainer: {
    borderRadius: 12,
    backgroundColor: '#16120f',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  faqSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  faqQuestion: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Manrope-500',
    color: '#FFFFFF',
    lineHeight: 20,
  },
  faqCaret: {
    transform: [{ rotate: '0deg' }],
    transitionProperty: 'transform',
    transitionDuration: '300ms',
  },
  faqCaretRotated: {
    transform: [{ rotate: '180deg' }],
  },
  faqAnswer: {
    fontSize: 14,
    fontFamily: 'Manrope-400',
    color: '#fffbf7',
    lineHeight: 20,
    paddingBottom: 8,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    minHeight: 56,
    justifyContent: 'space-between',
  },
  contactText: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Manrope-400',
    color: '#16120f',
    lineHeight: 24,
  },
  contactIcon: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
});

export default HelpAndSupportScreen;