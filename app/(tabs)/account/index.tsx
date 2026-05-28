import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Modal,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Linking,
  Alert,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { useAuthStore } from '../../../store/auth';
import { signOut } from '../../../lib/auth';
import { updateProfile, uploadProfilePhoto } from '../../../lib/repos/profiles';
import { getGroupsWithOutstandingBalances, anonymiseAccount } from '../../../lib/repos/account';
import {
  getNotificationPreferences,
  updateNotificationPreference,
  upsertPushToken,
  type PrefKey,
} from '../../../lib/repos/pushTokens';
import { supabase } from '../../../lib/supabase';
import { resolveAvatarUrl } from '../../../lib/displayName';
import { hapticOnToggle } from '../../../lib/haptics';
import { useColorScheme } from 'nativewind';
import { Colors } from '../../../constants/colors';
import { useThemeStore } from '../../../store/theme';
import type { Database } from '../../../lib/database.types';

type Currency = Database['public']['Tables']['profiles']['Row']['preferred_currency'];

type DeleteStep = 'closed' | 'balance-warning' | 'confirm-anonymise' | 'confirm-delete';

const CURRENCIES: { code: Currency; label: string; symbol: string }[] = [
  { code: 'USD', label: 'US Dollar', symbol: '$' },
  { code: 'EUR', label: 'Euro', symbol: '€' },
  { code: 'DKK', label: 'Danish Krone', symbol: 'kr' },
  { code: 'SEK', label: 'Swedish Krona', symbol: 'kr' },
];

const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';

export default function AccountScreen() {
  const queryClient = useQueryClient();
  const { session, profile, setProfile } = useAuthStore();

  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  const [showNameModal, setShowNameModal] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  const [showCurrencyModal, setShowCurrencyModal] = useState(false);
  const [isSavingCurrency, setIsSavingCurrency] = useState(false);

  const [deleteStep, setDeleteStep] = useState<DeleteStep>('closed');
  const [groupsWithBalances, setGroupsWithBalances] = useState<Array<{ id: string; name: string }>>([]);
  const [isCheckingBalances, setIsCheckingBalances] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [notifPermission, setNotifPermission] = useState<'granted' | 'denied' | 'undetermined'>('undetermined');

  const { preference: themePreference, setPreference: setThemePreference } = useThemeStore();
  const { colorScheme } = useColorScheme();
  const placeholderColor = colorScheme === 'dark' ? Colors.dark.textTertiary : Colors.light.textTertiary;


  const userId = session?.user.id ?? '';

  const { data: notifPrefs, refetch: refetchPrefs } = useQuery({
    queryKey: ['notification-preferences', userId],
    queryFn: () => getNotificationPreferences(supabase, userId),
    enabled: !!userId,
  });

  useEffect(() => {
    Notifications.getPermissionsAsync().then(({ status }) => {
      setNotifPermission(status as 'granted' | 'denied' | 'undetermined');
    });
  }, []);

  async function handleEnableNotifications() {
    const { status } = await Notifications.requestPermissionsAsync();
    setNotifPermission(status as 'granted' | 'denied' | 'undetermined');
    if (status === 'granted') {
      const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
      if (projectId) {
        try {
          const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
          await upsertPushToken(supabase, userId, token, Platform.OS);
        } catch { /* non-critical */ }
      }
    } else {
      Linking.openSettings();
    }
  }

  async function handleTogglePref(key: PrefKey, value: boolean) {
    hapticOnToggle();
    await updateNotificationPreference(supabase, userId, key, value).catch(() => {});
    refetchPrefs();
  }

  const gmailName = (session?.user?.user_metadata?.full_name as string | undefined) ?? '';
  const displayName = profile?.display_name || gmailName;
  const email = session?.user?.email ?? '';
  const avatarUrl = resolveAvatarUrl(profile?.avatar_url, profile?.google_avatar_url);
  const preferredCurrency = profile?.preferred_currency ?? 'USD';

  function renderAvatarContent() {
    if (isUploadingPhoto) return <ActivityIndicator color={Colors.accent} />;
    if (avatarUrl) return <Image source={{ uri: avatarUrl }} className="w-24 h-24" />;
    return (
      <Text className="font-display text-3xl font-semibold text-text-secondary">
        {displayName.charAt(0).toUpperCase()}
      </Text>
    );
  }

  async function handleSignOut() {
    setIsSigningOut(true);
    try {
      await signOut(queryClient);
    } finally {
      setIsSigningOut(false);
    }
  }

  async function handlePhotoChange() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission required', 'Allow photo library access to change your profile photo.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      base64: true,
    });

    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    if (asset.fileSize && asset.fileSize > 1_000_000) {
      Alert.alert('File too large', 'Please choose a photo under 1 MB.');
      return;
    }
    if (!asset.base64) {
      Alert.alert('Upload failed', 'Could not read image data. Please try again.');
      return;
    }

    setIsUploadingPhoto(true);
    try {
      const publicUrl = await uploadProfilePhoto(supabase, session!.user.id, asset.uri, asset.base64, asset.mimeType ?? undefined);
      const updated = await updateProfile(supabase, session!.user.id, { avatar_url: publicUrl });
      setProfile(updated);
      hapticOnToggle();
    } catch {
      Alert.alert('Upload failed', 'Could not upload your photo. Please try again.');
    } finally {
      setIsUploadingPhoto(false);
    }
  }

  function openNameModal() {
    setNameInput(profile?.display_name ?? gmailName);
    setNameError(null);
    setShowNameModal(true);
  }

  async function handleSaveName() {
    const trimmed = nameInput.trim();
    if (!trimmed) {
      setNameError('Name cannot be empty.');
      return;
    }
    setIsSavingName(true);
    setNameError(null);
    try {
      const updated = await updateProfile(supabase, session!.user.id, { display_name: trimmed });
      setProfile(updated);
      setShowNameModal(false);
    } catch {
      setNameError('Something went wrong. Please try again.');
    } finally {
      setIsSavingName(false);
    }
  }

  async function handleSelectCurrency(currency: Currency) {
    if (currency === preferredCurrency) {
      setShowCurrencyModal(false);
      return;
    }
    setIsSavingCurrency(true);
    try {
      const updated = await updateProfile(supabase, session!.user.id, {
        preferred_currency: currency,
      });
      setProfile(updated);
      hapticOnToggle();
      setShowCurrencyModal(false);
    } catch {
      Alert.alert('Error', 'Could not update currency. Please try again.');
    } finally {
      setIsSavingCurrency(false);
    }
  }

  async function openDeleteFlow() {
    setIsCheckingBalances(true);
    try {
      const groups = await getGroupsWithOutstandingBalances(supabase, session!.user.id);
      setGroupsWithBalances(groups);
      setDeleteStep(groups.length > 0 ? 'balance-warning' : 'confirm-anonymise');
    } catch {
      Alert.alert('Error', 'Could not check your balances. Please try again.');
    } finally {
      setIsCheckingBalances(false);
    }
  }

  async function handleAnonymise() {
    setIsDeletingAccount(true);
    setDeleteError(null);
    try {
      await anonymiseAccount(supabase, session!.user.id);
      setDeleteStep('confirm-delete');
    } catch {
      setDeleteError('Could not anonymise account. Please try again.');
    } finally {
      setIsDeletingAccount(false);
    }
  }

  async function handleFullDelete() {
    setIsDeletingAccount(true);
    setDeleteError(null);
    try {
      const { error } = await supabase.functions.invoke('delete-account');
      if (error) throw error;
      await signOut(queryClient);
    } catch {
      setDeleteError('Could not delete account. Please try again.');
      setIsDeletingAccount(false);
    }
  }

  function closeDeleteFlow() {
    if (isDeletingAccount) return;
    setDeleteStep('closed');
    setDeleteError(null);
    setGroupsWithBalances([]);
  }

  function renderConfirmStep(
    title: string,
    body: string,
    buttonLabel: string,
    buttonAccessibilityLabel: string,
    onConfirm: () => void,
  ) {
    return (
      <>
        <Text className="font-display text-xl font-bold text-text-primary mb-3">{title}</Text>
        <Text className="font-body text-base text-text-secondary mb-6">{body}</Text>
        {deleteError && (
          <Text className="font-body text-sm text-destructive mb-4">{deleteError}</Text>
        )}
        <TouchableOpacity
          onPress={onConfirm}
          disabled={isDeletingAccount}
          accessibilityLabel={buttonAccessibilityLabel}
          className="rounded-full py-4 items-center bg-destructive mb-3"
        >
          {isDeletingAccount ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text className="font-body font-medium text-base text-white">{buttonLabel}</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          onPress={closeDeleteFlow}
          disabled={isDeletingAccount}
          className="rounded-full py-4 items-center border border-border"
        >
          <Text className="font-body font-medium text-base text-text-primary">Cancel</Text>
        </TouchableOpacity>
      </>
    );
  }

  function renderDeleteModalContent() {
    if (deleteStep === 'balance-warning') {
      return (
        <>
          <Text className="font-display text-xl font-bold text-text-primary mb-3">
            Outstanding balances
          </Text>
          <Text className="font-body text-base text-text-secondary mb-4">
            You have unsettled balances in the following groups. Other members will still see your
            expense history after your data is anonymised.
          </Text>
          <View className="mb-6">
            {groupsWithBalances.map((g) => (
              <Text
                key={g.id}
                className="font-body text-base text-text-primary py-2 border-b border-border"
              >
                {g.name}
              </Text>
            ))}
          </View>
          <TouchableOpacity
            onPress={() => setDeleteStep('confirm-anonymise')}
            className="rounded-full py-4 items-center bg-destructive mb-3"
          >
            <Text className="font-body font-medium text-base text-white">Continue</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={closeDeleteFlow}
            className="rounded-full py-4 items-center border border-border"
          >
            <Text className="font-body font-medium text-base text-text-primary">Cancel</Text>
          </TouchableOpacity>
        </>
      );
    }

    if (deleteStep === 'confirm-anonymise') {
      return renderConfirmStep(
        'Anonymise your data?',
        '"Deleted User" will replace your name, and your profile photo and email will be permanently removed. Expense records remain visible to other group members.',
        'Anonymise my data',
        'Confirm anonymise account',
        handleAnonymise,
      );
    }

    if (deleteStep === 'confirm-delete') {
      return renderConfirmStep(
        'Permanently delete account?',
        'Your account and all personal data will be permanently deleted. You will not be able to sign in again. This cannot be undone.',
        'Yes, permanently delete',
        'Confirm full account deletion',
        handleFullDelete,
      );
    }

    return null;
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="px-6">
          <Text className="font-display text-2xl font-bold text-text-primary mt-6 mb-8">
            Account
          </Text>

          <View className="items-center mb-8">
            <TouchableOpacity
              onPress={handlePhotoChange}
              disabled={isUploadingPhoto}
              className="relative mb-4"
              accessibilityLabel="Change profile photo"
            >
              <View className="w-24 h-24 rounded-full bg-surface-2 items-center justify-center overflow-hidden border-2 border-border">
                {renderAvatarContent()}
              </View>
              <View className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-accent items-center justify-center">
                <Text className="text-white text-xs font-bold">✎</Text>
              </View>
            </TouchableOpacity>
            <Text className="font-display text-xl font-semibold text-text-primary">
              {displayName}
            </Text>
            <Text className="font-body text-sm text-text-secondary mt-1">{email}</Text>
          </View>

          <View className="bg-surface rounded-2xl border border-border overflow-hidden mb-4">
            <TouchableOpacity
              onPress={openNameModal}
              className="flex-row items-center justify-between px-5 py-4 border-b border-border"
              accessibilityLabel="Edit display name"
            >
              <Text className="font-body text-base text-text-primary">Display name</Text>
              <View className="flex-row items-center gap-2">
                <Text className="font-body text-base text-text-secondary">
                  {displayName}
                </Text>
                <Text className="text-text-tertiary">›</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setShowCurrencyModal(true)}
              className="flex-row items-center justify-between px-5 py-4"
              accessibilityLabel="Change preferred currency"
            >
              <Text className="font-body text-base text-text-primary">Preferred currency</Text>
              <View className="flex-row items-center gap-2">
                <Text className="font-body text-base text-text-secondary">{preferredCurrency}</Text>
                <Text className="text-text-tertiary">›</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Appearance */}
          <Text className="font-body text-xs text-text-tertiary uppercase tracking-wide px-1 mb-2">
            Appearance
          </Text>
          <View className="bg-surface rounded-2xl border border-border overflow-hidden mb-4">
            <View className="flex-row items-center justify-between px-5 py-4">
              <Text className="font-body text-base text-text-primary">Theme</Text>
              <View className="flex-row gap-2">
                {(['system', 'light', 'dark'] as const).map((option) => {
                  const isSelected = themePreference === option;
                  const label = option.charAt(0).toUpperCase() + option.slice(1);
                  return (
                    <TouchableOpacity
                      key={option}
                      onPress={() => setThemePreference(option)}
                      accessibilityLabel={`Select ${label} theme`}
                      accessibilityState={{ selected: isSelected }}
                      className={`px-3 py-1.5 rounded-full border ${
                        isSelected ? 'bg-accent/20 border-accent' : 'bg-surface-2 border-border'
                      }`}
                    >
                      <Text
                        className={`font-body text-sm font-medium ${
                          isSelected ? 'text-accent' : 'text-text-secondary'
                        }`}
                      >
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>


          {/* Notifications */}
          <Text className="font-body text-xs text-text-tertiary uppercase tracking-wide px-1 mb-2">
            Notifications
          </Text>
          <View className="bg-surface rounded-2xl border border-border overflow-hidden mb-4">
            {notifPermission !== 'granted' ? (
              <TouchableOpacity
                onPress={handleEnableNotifications}
                className="flex-row items-center justify-between px-5 py-4"
              >
                <Text className="font-body text-base text-text-primary">Enable notifications</Text>
                <Text className="text-text-tertiary">›</Text>
              </TouchableOpacity>
            ) : (
              <>
                {([
                  { key: 'new_expense' as PrefKey, label: 'New expense' },
                  { key: 'payment_received' as PrefKey, label: 'Payment received' },
                  { key: 'trip_ends_today' as PrefKey, label: 'Trip ends today' },
                ] as { key: PrefKey; label: string }[]).map(({ key, label }, idx, arr) => (
                  <View
                    key={key}
                    className={`flex-row items-center justify-between px-5 py-3.5 ${
                      idx < arr.length - 1 ? 'border-b border-border' : ''
                    }`}
                  >
                    <Text className="font-body text-base text-text-primary">{label}</Text>
                    <Switch
                      value={!!(notifPrefs as Record<string, unknown> | null)?.[key]}
                      onValueChange={(v) => handleTogglePref(key, v)}
                      trackColor={{ false: '#3a3a3a', true: Colors.accent }}
                      thumbColor="#ffffff"
                    />
                  </View>
                ))}
              </>
            )}
          </View>

          <View className="bg-surface rounded-2xl border border-border overflow-hidden mb-4">
            <TouchableOpacity
              onPress={() => router.push('/legal/privacy' as never)}
              className="flex-row items-center justify-between px-5 py-4 border-b border-border"
            >
              <Text className="font-body text-base text-text-primary">Privacy Policy</Text>
              <Text className="text-text-tertiary">›</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push('/legal/terms' as never)}
              className="flex-row items-center justify-between px-5 py-4"
            >
              <Text className="font-body text-base text-text-primary">Terms of Service</Text>
              <Text className="text-text-tertiary">›</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            onPress={handleSignOut}
            disabled={isSigningOut}
            className="rounded-full py-4 items-center border border-destructive/40 mb-4"
            accessibilityLabel="Sign out"
          >
            {isSigningOut ? (
              <ActivityIndicator color={Colors.destructive} />
            ) : (
              <Text className="font-body font-medium text-base text-destructive">Sign out</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={openDeleteFlow}
            disabled={isCheckingBalances}
            className="py-3 items-center mb-6"
            accessibilityLabel="Delete account"
          >
            {isCheckingBalances ? (
              <ActivityIndicator size="small" color={Colors.destructive} />
            ) : (
              <Text className="font-body text-sm text-text-tertiary">Delete account</Text>
            )}
          </TouchableOpacity>

          <Text className="font-body text-xs text-text-tertiary text-center">
            Version {APP_VERSION}
          </Text>
        </View>
      </ScrollView>

      <Modal
        visible={showNameModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowNameModal(false)}
      >
        <KeyboardAvoidingView
          behavior="padding"
          className="flex-1"
        >
          <TouchableOpacity
            className="flex-1 bg-black/70 justify-end"
            activeOpacity={1}
            onPress={() => setShowNameModal(false)}
          >
            <TouchableOpacity
              activeOpacity={1}
              className="bg-surface rounded-t-3xl px-6 pt-6 pb-10"
            >
              <Text className="font-display text-xl font-bold text-text-primary mb-6">
                Display name
              </Text>
              <TextInput
                className="bg-surface-2 text-text-primary font-body text-base px-4 py-4 rounded-2xl border border-border mb-2"
                value={nameInput}
                onChangeText={setNameInput}
                placeholder="Your name"
                placeholderTextColor={placeholderColor}
                autoFocus
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={handleSaveName}
                maxLength={60}
              />
              {nameError && (
                <Text className="font-body text-sm text-destructive mb-4">{nameError}</Text>
              )}
              <TouchableOpacity
                onPress={handleSaveName}
                disabled={isSavingName || nameInput.trim().length === 0}
                className={`rounded-full py-4 items-center mt-4 ${
                  isSavingName || nameInput.trim().length === 0 ? 'bg-accent/40' : 'bg-accent'
                }`}
              >
                {isSavingName ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text className="font-body font-medium text-base text-white">Save</Text>
                )}
              </TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={showCurrencyModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCurrencyModal(false)}
      >
        <TouchableOpacity
          className="flex-1 bg-black/70 justify-end"
          activeOpacity={1}
          onPress={() => setShowCurrencyModal(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            className="bg-surface rounded-t-3xl px-6 pt-6 pb-10"
          >
            <Text className="font-display text-xl font-bold text-text-primary mb-6">
              Preferred currency
            </Text>
            <View className="gap-3">
              {CURRENCIES.map(({ code, label, symbol }) => {
                const isSelected = preferredCurrency === code;
                return (
                  <TouchableOpacity
                    key={code}
                    onPress={() => handleSelectCurrency(code)}
                    disabled={isSavingCurrency}
                    className={`flex-row items-center px-5 py-4 rounded-2xl border ${
                      isSelected ? 'bg-accent-dim border-accent' : 'bg-surface-2 border-border'
                    }`}
                    accessibilityState={{ selected: isSelected }}
                  >
                    <Text className="font-display text-xl font-semibold text-text-primary w-10">
                      {symbol}
                    </Text>
                    <View className="flex-1">
                      <Text
                        className={`font-body text-base font-medium ${
                          isSelected ? 'text-accent' : 'text-text-primary'
                        }`}
                      >
                        {code}
                      </Text>
                      <Text className="font-body text-sm text-text-secondary">{label}</Text>
                    </View>
                    {isSelected && (
                      <Text className="text-accent font-bold">✓</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={deleteStep !== 'closed'}
        transparent
        animationType="fade"
        onRequestClose={closeDeleteFlow}
      >
        <TouchableOpacity
          className="flex-1 bg-black/70 justify-end"
          activeOpacity={1}
          onPress={closeDeleteFlow}
        >
          <TouchableOpacity
            activeOpacity={1}
            className="bg-surface rounded-t-3xl px-6 pt-6 pb-10"
          >
            {renderDeleteModalContent()}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

