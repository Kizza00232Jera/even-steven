import { useState } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import Constants from 'expo-constants';
import { useAuthStore } from '../../../store/auth';
import { signOut } from '../../../lib/auth';
import { updateProfile, uploadProfilePhoto } from '../../../lib/repos/profiles';
import { supabase } from '../../../lib/supabase';
import { resolveAvatarUrl } from '../../../lib/displayName';
import { hapticOnToggle } from '../../../lib/haptics';
import type { Database } from '../../../lib/database.types';

type Currency = Database['public']['Tables']['profiles']['Row']['preferred_currency'];

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

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  const gmailName = (session?.user?.user_metadata?.full_name as string | undefined) ?? '';
  const displayName = profile?.display_name || gmailName;
  const email = session?.user?.email ?? '';
  const avatarUrl = resolveAvatarUrl(profile?.avatar_url, profile?.google_avatar_url);
  const preferredCurrency = profile?.preferred_currency ?? 'USD';

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
    });

    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    if (asset.fileSize && asset.fileSize > 1_000_000) {
      Alert.alert('File too large', 'Please choose a photo under 1 MB.');
      return;
    }

    setIsUploadingPhoto(true);
    try {
      const publicUrl = await uploadProfilePhoto(supabase, session!.user.id, asset.uri);
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

  async function handleDeleteAccount() {
    setIsDeletingAccount(true);
    try {
      await updateProfile(supabase, session!.user.id, {
        display_name: null,
        avatar_url: null,
      });
      await signOut(queryClient);
    } catch {
      Alert.alert('Error', 'Could not delete account. Please try again.');
      setIsDeletingAccount(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="px-6">
          <Text className="font-display text-2xl font-bold text-text-primary mt-6 mb-8">
            Account
          </Text>

          {/* Profile photo + name */}
          <View className="items-center mb-8">
            <TouchableOpacity
              onPress={handlePhotoChange}
              disabled={isUploadingPhoto}
              className="relative mb-4"
              accessibilityLabel="Change profile photo"
            >
              <View className="w-24 h-24 rounded-full bg-surface-2 items-center justify-center overflow-hidden border-2 border-border">
                {isUploadingPhoto ? (
                  <ActivityIndicator color="#00C896" />
                ) : avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} className="w-24 h-24" />
                ) : (
                  <Text className="font-display text-3xl font-semibold text-text-secondary">
                    {displayName.charAt(0).toUpperCase()}
                  </Text>
                )}
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

          {/* Settings rows */}
          <View className="bg-surface rounded-2xl border border-border overflow-hidden mb-4">
            {/* Display name */}
            <TouchableOpacity
              onPress={openNameModal}
              className="flex-row items-center justify-between px-5 py-4 border-b border-border"
              accessibilityLabel="Edit display name"
            >
              <Text className="font-body text-base text-text-primary">Display name</Text>
              <View className="flex-row items-center gap-2">
                <Text className="font-body text-base text-text-secondary">
                  {profile?.display_name || gmailName}
                </Text>
                <Text className="text-text-tertiary">›</Text>
              </View>
            </TouchableOpacity>

            {/* Preferred currency */}
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

          {/* Legal links */}
          <View className="bg-surface rounded-2xl border border-border overflow-hidden mb-4">
            <TouchableOpacity
              onPress={() => Linking.openURL('https://even-steven.vercel.app/privacy')}
              className="flex-row items-center justify-between px-5 py-4 border-b border-border"
            >
              <Text className="font-body text-base text-text-primary">Privacy Policy</Text>
              <Text className="text-text-tertiary">›</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => Linking.openURL('https://even-steven.vercel.app/terms')}
              className="flex-row items-center justify-between px-5 py-4"
            >
              <Text className="font-body text-base text-text-primary">Terms of Service</Text>
              <Text className="text-text-tertiary">›</Text>
            </TouchableOpacity>
          </View>

          {/* Sign out */}
          <TouchableOpacity
            onPress={handleSignOut}
            disabled={isSigningOut}
            className="rounded-full py-4 items-center border border-destructive/40 mb-4"
            accessibilityLabel="Sign out"
          >
            {isSigningOut ? (
              <ActivityIndicator color="#FF4444" />
            ) : (
              <Text className="font-body font-medium text-base text-destructive">Sign out</Text>
            )}
          </TouchableOpacity>

          {/* Delete account */}
          <TouchableOpacity
            onPress={() => setShowDeleteModal(true)}
            className="py-3 items-center mb-6"
            accessibilityLabel="Delete account"
          >
            <Text className="font-body text-sm text-text-tertiary">Delete account</Text>
          </TouchableOpacity>

          {/* Version */}
          <Text className="font-body text-xs text-text-tertiary text-center">
            Version {APP_VERSION}
          </Text>
        </View>
      </ScrollView>

      {/* Edit display name modal */}
      <Modal
        visible={showNameModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowNameModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
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
                placeholderTextColor="rgba(255,255,255,0.3)"
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

      {/* Currency picker modal */}
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

      {/* Delete account confirmation modal */}
      <Modal
        visible={showDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <TouchableOpacity
          className="flex-1 bg-black/70 justify-end"
          activeOpacity={1}
          onPress={() => setShowDeleteModal(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            className="bg-surface rounded-t-3xl px-6 pt-6 pb-10"
          >
            <Text className="font-display text-xl font-bold text-text-primary mb-3">
              Delete account?
            </Text>
            <Text className="font-body text-base text-text-secondary mb-6">
              Your personal data will be anonymised. Expense records remain visible to other group members. This cannot be undone.
            </Text>
            <TouchableOpacity
              onPress={handleDeleteAccount}
              disabled={isDeletingAccount}
              className="rounded-full py-4 items-center bg-destructive mb-3"
              accessibilityLabel="Confirm delete account"
            >
              {isDeletingAccount ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text className="font-body font-medium text-base text-white">Yes, delete my account</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setShowDeleteModal(false)}
              className="rounded-full py-4 items-center border border-border"
            >
              <Text className="font-body font-medium text-base text-text-primary">Cancel</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}
