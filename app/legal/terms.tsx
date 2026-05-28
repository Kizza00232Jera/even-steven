import { ScrollView, Text, View, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { Colors } from '../../constants/colors';

function Section({ title }: { title: string }) {
  const { colorScheme } = useColorScheme();
  const theme = colorScheme === 'dark' ? Colors.dark : Colors.light;
  return (
    <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 16, color: theme.textPrimary, marginTop: 24, marginBottom: 6 }}>
      {title}
    </Text>
  );
}

function Body({ children }: { children: string }) {
  const { colorScheme } = useColorScheme();
  const theme = colorScheme === 'dark' ? Colors.dark : Colors.light;
  return (
    <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 14, color: theme.textSecondary, lineHeight: 22 }}>
      {children}
    </Text>
  );
}

function Bullet({ children }: { children: string }) {
  const { colorScheme } = useColorScheme();
  const theme = colorScheme === 'dark' ? Colors.dark : Colors.light;
  return (
    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 4 }}>
      <Text style={{ color: theme.textTertiary, fontSize: 14, lineHeight: 22 }}>•</Text>
      <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 14, color: theme.textSecondary, lineHeight: 22, flex: 1 }}>
        {children}
      </Text>
    </View>
  );
}

export default function TermsScreen() {
  const { colorScheme } = useColorScheme();
  const theme = colorScheme === 'dark' ? Colors.dark : Colors.light;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.border }}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={{ marginRight: 12 }}>
          <ArrowLeft size={22} color={theme.textPrimary} strokeWidth={1.8} />
        </TouchableOpacity>
        <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 18, color: theme.textPrimary }}>
          Terms of Service
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 48 }}>
        <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12, color: theme.textTertiary, marginTop: 16, marginBottom: 4 }}>
          Last updated: May 21, 2026
        </Text>

        <Body>
          These Terms of Service ("Terms") govern your use of Even Steven (the "Service"), operated by Even Steven ("we", "us"). By using the Service you agree to these Terms.
        </Body>

        <Section title="1. The Service" />
        <Body>
          Even Steven is a mobile application that helps groups of people track shared expenses and calculate the minimum settlements needed to balance accounts. The Service is provided for personal, non-commercial use.
        </Body>

        <Section title="2. Accounts" />
        <Body>
          You must sign in with a Google account to use Even Steven. You are responsible for all activity that occurs under your account. You must not share your account credentials or use another person's account without permission.
        </Body>

        <Section title="3. User Content" />
        <Body>
          You retain ownership of the expense data and other content you add to the Service. By adding content, you grant us a limited licence to store and display that content to other authorised members of your groups.{'\n\n'}You are responsible for the accuracy of expenses and settlements you record. Even Steven does not verify financial information and is not a financial services provider.
        </Body>

        <Section title="4. Acceptable Use" />
        <Body>You must not:</Body>
        <View style={{ marginTop: 8 }}>
          <Bullet>Use the Service for any unlawful purpose</Bullet>
          <Bullet>Attempt to access another user's data without authorisation</Bullet>
          <Bullet>Introduce malicious code or attempt to disrupt the Service</Bullet>
          <Bullet>Resell or commercialise access to the Service</Bullet>
          <Bullet>Impersonate another person</Bullet>
        </View>

        <Section title="5. Group Invites and Email" />
        <Body>
          When you add a person by email, an automated invite email is sent on your behalf. You represent that you have a legitimate reason to contact the recipient and that they would reasonably expect to receive this communication.
        </Body>

        <Section title="6. Disclaimers" />
        <Body>
          The Service is provided "as is" without warranties of any kind. We do not guarantee that the Service will be uninterrupted, error-free, or free of security vulnerabilities. Even Steven is not responsible for disputes between group members regarding expenses or settlements.
        </Body>

        <Section title="7. Limitation of Liability" />
        <Body>
          To the maximum extent permitted by law, Even Steven shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the Service, including financial loss resulting from inaccurate expense records.
        </Body>

        <Section title="8. Termination" />
        <Body>
          You may stop using the Service and delete your account at any time. We may suspend or terminate your access if you violate these Terms, with or without notice.
        </Body>

        <Section title="9. Changes to These Terms" />
        <Body>
          We may update these Terms. Continued use of the Service after changes are posted constitutes acceptance of the updated Terms. We will notify you of material changes via in-app notification.
        </Body>

        <Section title="10. Governing Law" />
        <Body>
          These Terms are governed by the laws of Denmark. Any disputes shall be resolved in the courts of Denmark.
        </Body>

        <Section title="11. Contact" />
        <Body>
          Questions about these Terms? Contact us at legal@evensteven.app.
        </Body>
      </ScrollView>
    </SafeAreaView>
  );
}
