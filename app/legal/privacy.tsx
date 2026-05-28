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

function Sub({ title }: { title: string }) {
  const { colorScheme } = useColorScheme();
  const theme = colorScheme === 'dark' ? Colors.dark : Colors.light;
  return (
    <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 14, color: theme.textPrimary, marginTop: 16, marginBottom: 4 }}>
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

export default function PrivacyScreen() {
  const { colorScheme } = useColorScheme();
  const theme = colorScheme === 'dark' ? Colors.dark : Colors.light;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.border }}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={{ marginRight: 12 }}>
          <ArrowLeft size={22} color={theme.textPrimary} strokeWidth={1.8} />
        </TouchableOpacity>
        <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 18, color: theme.textPrimary }}>
          Privacy Policy
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 48 }}>
        <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12, color: theme.textTertiary, marginTop: 16, marginBottom: 4 }}>
          Last updated: May 21, 2026
        </Text>

        <Body>
          Even Steven ("we", "us", or "our") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, and share information when you use the Even Steven mobile application and related services.
        </Body>

        <Section title="1. Information We Collect" />
        <Sub title="Account information" />
        <Body>
          When you sign in with Google, we receive your name, email address, and profile photo. You may choose a display name that differs from your Google name.
        </Body>
        <Sub title="Expense and group data" />
        <Body>
          We store the expenses, balances, and group information you create. This includes amounts, descriptions, categories, participant lists, and settlement records.
        </Body>
        <Sub title="Usage data" />
        <Body>
          We collect standard server logs (IP addresses, timestamps, feature interactions) to operate and improve the service.
        </Body>
        <Sub title="Push notification tokens" />
        <Body>
          If you enable notifications, we store your device push token to deliver alerts about group activity.
        </Body>

        <Section title="2. How We Use Your Information" />
        <Bullet>To provide and operate the Even Steven service</Bullet>
        <Bullet>To calculate and display shared expense balances</Bullet>
        <Bullet>To send transactional notifications (expense added, settlement recorded, invite received)</Bullet>
        <Bullet>To send invite emails on your behalf when you add group members by email</Bullet>
        <Bullet>To improve the app based on aggregate usage patterns</Bullet>

        <Section title="3. Data Sharing" />
        <Body>We do not sell your personal data. We share data only with:</Body>
        <View style={{ marginTop: 8 }}>
          <Bullet>Supabase — our database and authentication provider (EU region)</Bullet>
          <Bullet>Google — for authentication via Google Sign-In</Bullet>
          <Bullet>Expo / Expo Push Notifications — for delivering push alerts</Bullet>
          <Bullet>Resend — for sending invite emails on your behalf</Bullet>
          <Bullet>Other group members — expenses and balances you add are visible to participants in your group</Bullet>
        </View>

        <Section title="4. Expense Visibility" />
        <Body>
          Expenses are visible only to participants of that expense. Non-participants in the same group cannot see expenses they were not included in.
        </Body>

        <Section title="5. Data Retention" />
        <Body>
          Your data is retained for as long as your account exists. You may delete your account at any time from the Account settings screen. Account deletion permanently removes your profile, anonymises your contributions to shared expenses, and cannot be undone.
        </Body>

        <Section title="6. Your Rights (GDPR)" />
        <Body>
          If you are located in the European Economic Area, you have the right to access, correct, or delete your personal data, and to object to or restrict its processing. To exercise these rights, contact us at the address below. You also have the right to lodge a complaint with your local data protection authority.
        </Body>

        <Section title="7. Data Security" />
        <Body>
          All data is transmitted over HTTPS and stored in encrypted databases hosted in the EU (Stockholm, Sweden). Row-level security policies ensure users can only access data they are authorised to see.
        </Body>

        <Section title="8. Changes to This Policy" />
        <Body>
          We may update this Privacy Policy from time to time. We will notify you of material changes via a push notification or in-app banner.
        </Body>

        <Section title="9. Contact" />
        <Body>
          Questions about this policy? Reach us at privacy@evensteven.app.
        </Body>
      </ScrollView>
    </SafeAreaView>
  );
}
