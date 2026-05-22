import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Switch,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useColorScheme } from 'nativewind';
import { X, ChevronLeft, Plane, Home, Heart, Zap, Users, Grid3X3 } from 'lucide-react-native';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Stop, Rect } from 'react-native-svg';
import { useQueryClient } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Colors } from '../../constants/colors';
import { useAuthStore } from '../../store/auth';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { useOfflineGuard } from '../../hooks/useOfflineGuard';
import { createGroup } from '../../lib/repos/groups';
import { logActivityEvent } from '../../lib/repos/activity';
import { upsertPushToken } from '../../lib/repos/pushTokens';
import { supabase } from '../../lib/supabase';
import type { Database } from '../../lib/database.types';

type GroupType = Database['public']['Tables']['groups']['Row']['type'];
type Currency = Database['public']['Tables']['groups']['Row']['base_currency'];

const GROUP_TYPES: { type: GroupType; label: string; Icon: React.ComponentType<{ size: number; color: string; strokeWidth: number }> }[] = [
  { type: 'Trip', label: 'Trip', Icon: Plane },
  { type: 'Home', label: 'Home', Icon: Home },
  { type: 'Couple', label: 'Couple', Icon: Heart },
  { type: 'Utilities', label: 'Utilities', Icon: Zap },
  { type: 'Family', label: 'Family', Icon: Users },
  { type: 'Other', label: 'Other', Icon: Grid3X3 },
];

const CURRENCIES: { code: Currency; symbol: string }[] = [
  { code: 'USD', symbol: '$' },
  { code: 'EUR', symbol: '€' },
  { code: 'DKK', symbol: 'kr' },
  { code: 'SEK', symbol: 'kr' },
];

const NAME_MAX_LENGTH = 30;

function toISODate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function todayStart(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function daysFromToday(n: number): Date {
  const d = todayStart();
  d.setDate(d.getDate() + n);
  return d;
}

function GradientBackground({ colors, id }: { colors: readonly [string, string]; id: string }) {
  return (
    <Svg style={StyleSheet.absoluteFill}>
      <Defs>
        <SvgLinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={colors[0]} />
          <Stop offset="1" stopColor={colors[1]} />
        </SvgLinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}

function ProgressIndicator({ step }: { step: 1 | 2 | 3 }) {
  const { colorScheme } = useColorScheme();
  const theme = colorScheme === 'dark' ? Colors.dark : Colors.light;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      {([1, 2, 3] as const).map((s) => (
        <View
          key={s}
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: s <= step ? Colors.accent : theme.surface2,
            opacity: s < step ? 0.55 : 1,
          }}
        >
          <Text style={{ color: '#ffffff', fontSize: 12, fontFamily: 'Inter_500Medium' }}>
            {s}
          </Text>
        </View>
      ))}
    </View>
  );
}

// Pure-JS date field — no native modules required.
// User types 8 digits; dashes are auto-inserted (YYYY-MM-DD).
function DateField({
  label,
  value,
  onChange,
  minimumDate,
  testID,
}: {
  label: string;
  value: Date;
  onChange: (d: Date) => void;
  minimumDate?: Date;
  testID?: string;
}) {
  const isoValue = toISODate(value);
  const [text, setText] = useState(isoValue);
  const { colorScheme } = useColorScheme();
  const theme = colorScheme === 'dark' ? Colors.dark : Colors.light;

  // Sync display if the date was changed from outside (e.g. end clamped to start)
  useEffect(() => {
    setText(isoValue);
  }, [isoValue]);

  function handleChangeText(raw: string) {
    const digits = raw.replace(/\D/g, '').slice(0, 8);
    let formatted = digits;
    if (digits.length > 4) formatted = `${digits.slice(0, 4)}-${digits.slice(4)}`;
    if (digits.length > 6) formatted = `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
    setText(formatted);

    if (digits.length === 8) {
      const year = parseInt(digits.slice(0, 4), 10);
      const month = parseInt(digits.slice(4, 6), 10) - 1;
      const day = parseInt(digits.slice(6, 8), 10);
      const d = new Date(year, month, day);
      const isValid =
        !isNaN(d.getTime()) &&
        d.getFullYear() === year &&
        d.getMonth() === month &&
        d.getDate() === day;
      if (isValid && (!minimumDate || d >= minimumDate)) {
        onChange(d);
      }
    }
  }

  function handleBlur() {
    setText(isoValue);
  }

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: theme.surface,
        borderWidth: 1,
        borderColor: theme.border,
        borderRadius: 16,
        paddingHorizontal: 16,
        paddingVertical: 14,
      }}
    >
      <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 16, color: theme.textSecondary }}>
        {label}
      </Text>
      <TextInput
        testID={testID}
        value={text}
        onChangeText={handleChangeText}
        onBlur={handleBlur}
        keyboardType="numeric"
        maxLength={10}
        style={{
          fontFamily: 'Inter_500Medium',
          fontSize: 16,
          color: Colors.accent,
          textAlign: 'right',
          minWidth: 110,
        }}
        placeholder="YYYY-MM-DD"
        placeholderTextColor={theme.textTertiary}
      />
    </View>
  );
}

function Step1TypeSelection({
  selected,
  onSelect,
}: {
  selected: GroupType | null;
  onSelect: (type: GroupType) => void;
}) {
  return (
    <View>
      <Text className="font-display text-2xl font-bold text-text-primary mb-2">
        What kind of group?
      </Text>
      <Text className="font-body text-base text-text-secondary mb-6">
        Choose the type that best fits your group.
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {GROUP_TYPES.map(({ type, label, Icon }) => {
          const isSelected = selected === type;
          const gradientKey = type.toLowerCase() as keyof typeof Colors.gradients;
          const gradientColors = Colors.gradients[gradientKey];
          return (
            <TouchableOpacity
              key={type}
              testID={`type-card-${type}`}
              onPress={() => onSelect(type)}
              style={{
                width: '30.5%',
                aspectRatio: 0.9,
                borderRadius: 16,
                overflow: 'hidden',
                borderWidth: isSelected ? 2 : 0,
                borderColor: isSelected ? Colors.accent : 'transparent',
              }}
              accessibilityState={{ selected: isSelected }}
            >
              <GradientBackground colors={gradientColors} id={`grad-${type}`} />
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <Icon size={26} color="#ffffff" strokeWidth={1.5} />
                <Text style={{ color: '#ffffff', fontSize: 12, fontFamily: 'Inter_500Medium' }}>
                  {label}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function Step2Details({
  groupType,
  name,
  onNameChange,
  currency,
  onCurrencyChange,
  startDate,
  onStartDateChange,
  endDate,
  onEndDateChange,
  placeholderColor,
}: {
  groupType: GroupType;
  name: string;
  onNameChange: (v: string) => void;
  currency: Currency;
  onCurrencyChange: (v: Currency) => void;
  startDate: Date;
  onStartDateChange: (d: Date) => void;
  endDate: Date;
  onEndDateChange: (d: Date) => void;
  placeholderColor: string;
}) {
  const isTrip = groupType === 'Trip';

  return (
    <View style={{ gap: 24 }}>
      <View>
        <Text className="font-display text-2xl font-bold text-text-primary mb-2">
          Group details
        </Text>
        <Text className="font-body text-base text-text-secondary">
          You can change most of this later.
        </Text>
      </View>

      <View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <Text className="font-body text-sm font-medium text-text-secondary">Group name</Text>
          <Text className="font-body text-xs text-text-tertiary">
            {name.length}/{NAME_MAX_LENGTH}
          </Text>
        </View>
        <TextInput
          className="bg-surface border border-border rounded-2xl px-4 py-4 font-body text-base text-text-primary"
          placeholder="Group name"
          placeholderTextColor={placeholderColor}
          value={name}
          onChangeText={(t) => onNameChange(t.slice(0, NAME_MAX_LENGTH))}
          autoFocus
          returnKeyType="done"
          testID="name-input"
        />
      </View>

      <View>
        <Text className="font-body text-sm font-medium text-text-secondary mb-3">
          Base currency
        </Text>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {CURRENCIES.map(({ code, symbol }) => {
            const isSelected = currency === code;
            return (
              <TouchableOpacity
                key={code}
                testID={`currency-${code}`}
                onPress={() => onCurrencyChange(code)}
                className={`flex-1 py-3 rounded-2xl border items-center justify-center ${
                  isSelected ? 'bg-accent-dim border-accent' : 'bg-surface border-border'
                }`}
                accessibilityState={{ selected: isSelected }}
              >
                <Text
                  className={`font-body text-sm font-semibold ${
                    isSelected ? 'text-accent' : 'text-text-primary'
                  }`}
                >
                  {symbol}
                </Text>
                <Text
                  className={`font-body text-xs ${
                    isSelected ? 'text-accent' : 'text-text-secondary'
                  }`}
                >
                  {code}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {isTrip && (
        <View style={{ gap: 10 }}>
          <Text className="font-body text-sm font-medium text-text-secondary">
            Trip dates <Text className="font-body text-xs text-text-tertiary">(YYYY-MM-DD)</Text>
          </Text>
          <DateField
            label="Start"
            value={startDate}
            onChange={onStartDateChange}
            testID="start-date-input"
          />
          <DateField
            label="End"
            value={endDate}
            onChange={onEndDateChange}
            minimumDate={startDate}
            testID="end-date-input"
          />
        </View>
      )}
    </View>
  );
}

function Step3Members({
  emailInput,
  onEmailInputChange,
  onAddEmail,
  inviteEmails,
  onRemoveEmail,
  settlementVisibility,
  onSettlementVisibilityChange,
  placeholderColor,
  iconColor,
}: {
  emailInput: string;
  onEmailInputChange: (v: string) => void;
  onAddEmail: () => void;
  inviteEmails: string[];
  onRemoveEmail: (email: string) => void;
  settlementVisibility: 'public' | 'private';
  onSettlementVisibilityChange: (isPrivate: boolean) => void;
  placeholderColor: string;
  iconColor: string;
}) {
  return (
    <View style={{ gap: 24 }}>
      <View>
        <Text className="font-display text-2xl font-bold text-text-primary mb-2">
          Members &amp; settings
        </Text>
        <Text className="font-body text-base text-text-secondary">
          Both are optional — you can change these later.
        </Text>
      </View>

      <View style={{ gap: 10 }}>
        <Text className="font-body text-sm font-medium text-text-secondary">Invite members</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TextInput
            className="flex-1 bg-surface border border-border rounded-2xl px-4 py-4 font-body text-base text-text-primary"
            placeholder="Email address"
            placeholderTextColor={placeholderColor}
            value={emailInput}
            onChangeText={onEmailInputChange}
            keyboardType="email-address"
            autoCapitalize="none"
            returnKeyType="done"
            onSubmitEditing={onAddEmail}
            testID="email-input"
          />
          <TouchableOpacity
            onPress={onAddEmail}
            disabled={!emailInput.trim()}
            testID="add-email-button"
            style={{
              paddingHorizontal: 16,
              paddingVertical: 16,
              borderRadius: 16,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: emailInput.trim() ? Colors.accent : 'rgba(0,0,0,0.06)',
            }}
          >
            <Text
              style={{
                fontSize: 14,
                fontFamily: 'Inter_500Medium',
                color: emailInput.trim() ? '#ffffff' : iconColor,
              }}
            >
              Add
            </Text>
          </TouchableOpacity>
        </View>

        {inviteEmails.map((email) => (
          <View
            key={email}
            className="flex-row items-center justify-between bg-surface border border-border rounded-2xl px-4 py-3"
          >
            <Text className="font-body text-sm text-text-primary flex-1">{email}</Text>
            <TouchableOpacity
              onPress={() => onRemoveEmail(email)}
              testID={`remove-email-${email}`}
            >
              <X size={16} color={iconColor} strokeWidth={2} />
            </TouchableOpacity>
          </View>
        ))}
      </View>

      <View className="flex-row items-center bg-surface border border-border rounded-2xl px-4 py-4">
        <View style={{ flex: 1, gap: 4 }}>
          <Text className="font-body text-base font-medium text-text-primary">
            Settlement visibility
          </Text>
          <Text className="font-body text-xs text-text-secondary">
            {settlementVisibility === 'public'
              ? 'All members can see who paid whom'
              : 'Only the parties involved can see settlements'}
          </Text>
        </View>
        <Switch
          value={settlementVisibility === 'private'}
          onValueChange={onSettlementVisibilityChange}
          testID="settlement-visibility-toggle"
          trackColor={{ false: 'rgba(0,0,0,0.1)', true: Colors.accent }}
          thumbColor="#ffffff"
        />
      </View>
    </View>
  );
}

export default function CreateGroupScreen() {
  const router = useRouter();
  const { session, profile } = useAuthStore();
  const { isOnline } = useNetworkStatus();
  const { writesDisabled } = useOfflineGuard(isOnline);
  const queryClient = useQueryClient();
  const { colorScheme } = useColorScheme();
  const theme = colorScheme === 'dark' ? Colors.dark : Colors.light;

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [groupType, setGroupType] = useState<GroupType | null>(null);
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState<Currency>('USD');
  const [startDate, setStartDate] = useState<Date>(todayStart);
  const [endDate, setEndDate] = useState<Date>(() => daysFromToday(7));
  const [emailInput, setEmailInput] = useState('');
  const [inviteEmails, setInviteEmails] = useState<string[]>([]);
  const [settlementVisibility, setSettlementVisibility] = useState<'public' | 'private'>('public');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canAdvanceStep1 = groupType !== null;
  const canAdvanceStep2 =
    name.trim().length > 0 &&
    (groupType !== 'Trip' || startDate <= endDate);

  function goBack() {
    if (step === 1) {
      router.back();
    } else {
      setStep((s) => (s - 1) as 1 | 2 | 3);
      setError(null);
    }
  }

  function handleNext() {
    if (step === 1 && canAdvanceStep1) setStep(2);
    else if (step === 2 && canAdvanceStep2) setStep(3);
  }

  function handleAddEmail() {
    const email = emailInput.trim().toLowerCase();
    if (!email) return;
    if (!inviteEmails.includes(email)) {
      setInviteEmails((prev) => [...prev, email]);
    }
    setEmailInput('');
  }

  function handleRemoveEmail(email: string) {
    setInviteEmails((prev) => prev.filter((e) => e !== email));
  }

  async function requestAndRegisterPushToken(userId: string) {
    const { status: existing } = await Notifications.getPermissionsAsync();
    const finalStatus =
      existing === 'granted'
        ? 'granted'
        : (await Notifications.requestPermissionsAsync()).status;
    if (finalStatus !== 'granted') return;
    const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
    if (!projectId) return;
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await upsertPushToken(supabase, userId, token, Platform.OS);
  }

  async function handleCreate() {
    if (!session || !groupType) return;
    setIsSaving(true);
    setError(null);
    try {
      const newGroup = await createGroup(
        supabase,
        {
          name: name.trim(),
          type: groupType,
          base_currency: currency,
          admin_id: session.user.id,
          start_date: groupType === 'Trip' ? toISODate(startDate) : null,
          end_date: groupType === 'Trip' ? toISODate(endDate) : null,
          settlement_visibility: settlementVisibility,
        },
        {
          userId: session.user.id,
          email: session.user.email!,
          displayName: profile?.display_name ?? null,
        },
        inviteEmails,
      );
      logActivityEvent(supabase, {
        groupId: newGroup.id,
        actorId: session.user.id,
        eventType: 'group_created',
        metadata: { name: name.trim() },
      }).catch(() => {});
      // Request push notification permission after first group creation (spec §38)
      requestAndRegisterPushToken(session.user.id).catch(() => {});
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      router.back();
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }

  const isNextDisabled =
    (step === 1 && !canAdvanceStep1) || (step === 2 && !canAdvanceStep2);

  const isCreateDisabled = isSaving || writesDisabled;

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={{ flex: 1, paddingHorizontal: 16 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingTop: 16,
              marginBottom: 24,
            }}
          >
            <TouchableOpacity
              onPress={goBack}
              testID="back-button"
              style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}
            >
              {step === 1 ? (
                <X size={22} color={theme.textPrimary} strokeWidth={2} />
              ) : (
                <ChevronLeft size={22} color={theme.textPrimary} strokeWidth={2} />
              )}
            </TouchableOpacity>
            <ProgressIndicator step={step} />
            <View style={{ width: 40 }} />
          </View>

          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
            {step === 1 && (
              <Step1TypeSelection selected={groupType} onSelect={setGroupType} />
            )}
            {step === 2 && groupType && (
              <Step2Details
                groupType={groupType}
                name={name}
                onNameChange={setName}
                currency={currency}
                onCurrencyChange={setCurrency}
                startDate={startDate}
                onStartDateChange={setStartDate}
                endDate={endDate}
                onEndDateChange={setEndDate}
                placeholderColor={theme.textTertiary}
              />
            )}
            {step === 3 && (
              <Step3Members
                emailInput={emailInput}
                onEmailInputChange={setEmailInput}
                onAddEmail={handleAddEmail}
                inviteEmails={inviteEmails}
                onRemoveEmail={handleRemoveEmail}
                settlementVisibility={settlementVisibility}
                onSettlementVisibilityChange={(isPrivate) =>
                  setSettlementVisibility(isPrivate ? 'private' : 'public')
                }
                placeholderColor={theme.textTertiary}
                iconColor={theme.textSecondary}
              />
            )}
            <View style={{ height: 24 }} />
          </ScrollView>

          {error && (
            <Text className="font-body text-sm text-destructive mt-1 mb-2">{error}</Text>
          )}

          <View style={{ paddingBottom: 16, gap: 12 }}>
            {step === 3 ? (
              <TouchableOpacity
                onPress={handleCreate}
                disabled={isCreateDisabled}
                testID="create-button"
                className={`rounded-full py-4 items-center ${
                  isCreateDisabled ? 'bg-accent/40' : 'bg-accent'
                }`}
                accessibilityState={{ disabled: isCreateDisabled }}
              >
                {isSaving ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text className="font-body font-medium text-base text-white">Create Group</Text>
                )}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={handleNext}
                disabled={isNextDisabled}
                testID="next-button"
                className={`rounded-full py-4 items-center ${
                  isNextDisabled ? 'bg-accent/40' : 'bg-accent'
                }`}
                accessibilityState={{ disabled: isNextDisabled }}
              >
                <Text className="font-body font-medium text-base text-white">Next</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
