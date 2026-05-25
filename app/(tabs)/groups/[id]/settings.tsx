import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { useColorScheme } from 'nativewind';
import {
  ArrowLeft,
  ChevronRight,
  Users,
  Bell,
  BellOff,
  ImageIcon,
  Share2,
  LogOut,
  Pencil,
  Calendar,
  Eye,
  Link,
  Archive,
  ArchiveRestore,
  Trash2,
} from 'lucide-react-native';
import { useAuthStore } from '../../../../store/auth';
import { supabase } from '../../../../lib/supabase';
import { Colors } from '../../../../constants/colors';
import {
  fetchGroupDetail,
  renameGroup,
  archiveGroup,
  unarchiveGroup,
  deleteGroup,
  leaveGroup,
  uploadGroupPhoto,
  updateSettlementVisibility,
  extendTripEndDate,
  toggleMuteGroup,
} from '../../../../lib/repos/groups';
import { logActivityEvent } from '../../../../lib/repos/activity';
import { getOrCreateInviteToken, resetInviteToken } from '../../../../lib/repos/invites';

const INVITE_BASE_URL = 'https://even-steven-five.vercel.app/invite';

const rowClass = 'flex-row items-center justify-between px-4 py-4 border-b border-border';
const rowLabelClass = 'font-body text-base text-text-primary ml-3 flex-1';
const rowIconContainer = 'w-8 h-8 rounded-full bg-surface-2 items-center justify-center';
const sectionHeaderClass = 'font-body text-xs text-text-tertiary uppercase tracking-widest px-4 pt-6 pb-2';

export default function GroupSettingsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colorScheme } = useColorScheme();
  const theme = colorScheme === 'dark' ? Colors.dark : Colors.light;
  const { session } = useAuthStore();
  const userId = session?.user?.id ?? '';

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['group', id, 'settings'],
    queryFn: () => fetchGroupDetail(supabase, id, userId),
    enabled: !!id && !!userId,
  });

  const group = data?.group;
  const isAdmin = data?.currentMemberRole === 'admin';
  const isTrip = group?.type === 'Trip';
  const isArchived = group?.status === 'archived';
  const memberCount = data?.memberCount ?? 0;
  const currentMemberId = data?.currentMemberId ?? '';
  const currentMemberIsMuted = data?.currentMemberIsMuted ?? false;
  const hasUnsettledBalances = data?.hasUnsettledBalances ?? false;

  // Rename modal
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);

  // Settlement visibility modal
  const [showVisibilityModal, setShowVisibilityModal] = useState(false);
  const [isUpdatingVisibility, setIsUpdatingVisibility] = useState(false);

  // Extend trip date modal
  const [showExtendDateModal, setShowExtendDateModal] = useState(false);
  const [endDateInput, setEndDateInput] = useState('');
  const [isExtendingDate, setIsExtendingDate] = useState(false);

  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [isMuting, setIsMuting] = useState(false);
  const [isSharingInvite, setIsSharingInvite] = useState(false);
  const [isResettingInvite, setIsResettingInvite] = useState(false);

  async function handleShareInvite() {
    setIsSharingInvite(true);
    try {
      const token = await getOrCreateInviteToken(supabase, id, currentMemberId);
      const url = `${INVITE_BASE_URL}/${token}`;
      await Share.share({ message: url, url });
    } catch {
      Alert.alert('Error', 'Could not generate invite link. Please try again.');
    } finally {
      setIsSharingInvite(false);
    }
  }

  async function handleResetInvite() {
    Alert.alert(
      'Reset invite link',
      'The current link will stop working immediately. A new link will be generated.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            setIsResettingInvite(true);
            try {
              await resetInviteToken(supabase, id, currentMemberId);
            } catch {
              Alert.alert('Error', 'Could not reset invite link. Please try again.');
            } finally {
              setIsResettingInvite(false);
            }
          },
        },
      ],
    );
  }

  function invalidateGroupQueries() {
    queryClient.invalidateQueries({ queryKey: ['group', id] });
    queryClient.invalidateQueries({ queryKey: ['groups'] });
  }

  function openRenameModal() {
    setNameInput(group?.name ?? '');
    setShowRenameModal(true);
  }

  async function handleRename() {
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    setIsRenaming(true);
    try {
      await renameGroup(supabase, id, trimmed);
      invalidateGroupQueries();
      setShowRenameModal(false);
    } finally {
      setIsRenaming(false);
    }
  }

  async function handlePhotoChange() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission required', 'Allow photo library access to change the group photo.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });

    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    if (asset.fileSize && asset.fileSize > 2_000_000) {
      Alert.alert('Photo too large', 'Please select a photo smaller than 2 MB.');
      return;
    }

    setIsUploadingPhoto(true);
    try {
      await uploadGroupPhoto(supabase, id, asset.uri);
      invalidateGroupQueries();
    } catch {
      Alert.alert('Error', 'Failed to upload photo. Please try again.');
    } finally {
      setIsUploadingPhoto(false);
    }
  }

  async function handleToggleMute() {
    setIsMuting(true);
    try {
      await toggleMuteGroup(supabase, currentMemberId, !currentMemberIsMuted);
      invalidateGroupQueries();
    } finally {
      setIsMuting(false);
    }
  }

  async function handleVisibilitySelect(visibility: 'public' | 'private') {
    setIsUpdatingVisibility(true);
    try {
      await updateSettlementVisibility(supabase, id, visibility);
      invalidateGroupQueries();
      setShowVisibilityModal(false);
    } finally {
      setIsUpdatingVisibility(false);
    }
  }

  function openExtendDateModal() {
    setEndDateInput(group?.end_date ?? '');
    setShowExtendDateModal(true);
  }

  async function handleExtendDate() {
    const trimmed = endDateInput.trim();
    if (!trimmed) return;
    setIsExtendingDate(true);
    try {
      await extendTripEndDate(supabase, id, trimmed);
      invalidateGroupQueries();
      setShowExtendDateModal(false);
    } finally {
      setIsExtendingDate(false);
    }
  }

  function handleArchive() {
    Alert.alert(
      'Archive group',
      'This will archive the group. All history is preserved.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          style: 'destructive',
          onPress: async () => {
            setIsArchiving(true);
            try {
              await archiveGroup(supabase, id);
              logActivityEvent(supabase, {
                groupId: id,
                actorId: userId,
                eventType: 'group_archived',
              }).catch(() => {});
              invalidateGroupQueries();
              router.back();
            } finally {
              setIsArchiving(false);
            }
          },
        },
      ]
    );
  }

  function handleUnarchive() {
    Alert.alert(
      'Unarchive group',
      'This will move the group back to your active groups.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unarchive',
          onPress: async () => {
            try {
              await unarchiveGroup(supabase, id);
              invalidateGroupQueries();
              router.back();
            } catch {
              Alert.alert('Error', 'Failed to unarchive group. Please try again.');
            }
          },
        },
      ]
    );
  }

  function handleDelete() {
    if (hasUnsettledBalances) {
      Alert.alert(
        'Unsettled balances',
        'Some members have outstanding balances. Are you sure you want to delete this group?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Continue',
            style: 'destructive',
            onPress: () => {
              Alert.alert(
                'Delete group?',
                'This will permanently erase all history for this group and cannot be undone.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Yes, delete',
                    style: 'destructive',
                    onPress: performDelete,
                  },
                ]
              );
            },
          },
        ]
      );
    } else {
      Alert.alert(
        `Delete "${group?.name ?? 'group'}"?`,
        'This will permanently erase all history for this group and cannot be undone.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: performDelete },
        ]
      );
    }
  }

  async function performDelete() {
    setIsDeleting(true);
    try {
      await deleteGroup(supabase, id);
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      router.replace('/(tabs)/groups');
    } finally {
      setIsDeleting(false);
    }
  }

  function handleLeave() {
    Alert.alert(
      `Leave "${group?.name ?? 'group'}"?`,
      isAdmin
        ? 'Admin role will be transferred to the next member.'
        : 'You will lose access to this group.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            setIsLeaving(true);
            try {
              await leaveGroup(supabase, id, currentMemberId, isAdmin);
              logActivityEvent(supabase, {
                groupId: id,
                actorId: userId,
                eventType: 'member_left',
              }).catch(() => {});
              queryClient.invalidateQueries({ queryKey: ['groups'] });
              router.replace('/(tabs)/groups');
            } finally {
              setIsLeaving(false);
            }
          },
        },
      ]
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator color={Colors.accent} />
      </SafeAreaView>
    );
  }

  if (isError || !data) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center px-4">
          <Text className="font-body text-text-secondary text-center mb-4">
            Failed to load settings.
          </Text>
          <TouchableOpacity onPress={() => refetch()} className="bg-surface border border-border rounded-xl px-4 py-2">
            <Text className="font-body text-text-primary">Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 border-b border-border">
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <ArrowLeft size={22} color={theme.textPrimary} />
        </TouchableOpacity>
        <Text className="font-display text-lg font-semibold text-text-primary flex-1">
          Group Settings
        </Text>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 }}>
        {/* All Members Section */}
        <Text className={sectionHeaderClass}>General</Text>
        <View className="bg-surface rounded-2xl mx-4 border border-border overflow-hidden">
          <TouchableOpacity
            testID="settings-members-row"
            onPress={() => router.push(`/groups/${id}/members` as never)}
            className={rowClass}
            activeOpacity={0.7}
          >
            <View className={rowIconContainer}>
              <Users size={16} color={Colors.accent} />
            </View>
            <Text className={rowLabelClass}>Members ({memberCount})</Text>
            <ChevronRight size={16} color={theme.textTertiary} />
          </TouchableOpacity>

          <TouchableOpacity
            testID="settings-mute-row"
            onPress={handleToggleMute}
            className={rowClass}
            activeOpacity={0.7}
            disabled={isMuting}
          >
            <View className={rowIconContainer}>
              {currentMemberIsMuted ? (
                <BellOff size={16} color={theme.textSecondary} />
              ) : (
                <Bell size={16} color={theme.textSecondary} />
              )}
            </View>
            <Text className={rowLabelClass}>
              {currentMemberIsMuted ? 'Unmute notifications' : 'Mute notifications'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            testID="settings-photo-row"
            onPress={handlePhotoChange}
            className={rowClass}
            activeOpacity={0.7}
            disabled={isUploadingPhoto}
          >
            <View className={rowIconContainer}>
              {isUploadingPhoto ? (
                <ActivityIndicator size="small" color={Colors.accent} />
              ) : (
                <ImageIcon size={16} color={theme.textSecondary} />
              )}
            </View>
            <Text className={rowLabelClass}>Change background photo</Text>
          </TouchableOpacity>

          <TouchableOpacity
            testID="settings-share-row"
            onPress={handleShareInvite}
            className={`${rowClass} border-b-0`}
            activeOpacity={0.7}
            disabled={isSharingInvite}
          >
            <View className={rowIconContainer}>
              {isSharingInvite ? (
                <ActivityIndicator size="small" color={Colors.accent} />
              ) : (
                <Share2 size={16} color={theme.textSecondary} />
              )}
            </View>
            <Text className={rowLabelClass}>Share invite link</Text>
          </TouchableOpacity>
        </View>

        {/* Admin Section */}
        {isAdmin && (
          <>
            <Text className={sectionHeaderClass}>Admin</Text>
            <View className="bg-surface rounded-2xl mx-4 border border-border overflow-hidden">
              <TouchableOpacity
                testID="settings-rename-row"
                onPress={openRenameModal}
                className={rowClass}
                activeOpacity={0.7}
              >
                <View className={rowIconContainer}>
                  <Pencil size={16} color={Colors.accent} />
                </View>
                <Text className={rowLabelClass}>Change group name</Text>
                <ChevronRight size={16} color={theme.textTertiary} />
              </TouchableOpacity>

              {isTrip && (
                <TouchableOpacity
                  testID="settings-extend-date-row"
                  onPress={openExtendDateModal}
                  className={rowClass}
                  activeOpacity={0.7}
                >
                  <View className={rowIconContainer}>
                    <Calendar size={16} color={Colors.accent} />
                  </View>
                  <Text className={rowLabelClass}>
                    Extend end date
                    {group?.end_date ? ` (${group.end_date})` : ''}
                  </Text>
                  <ChevronRight size={16} color={theme.textTertiary} />
                </TouchableOpacity>
              )}

              <TouchableOpacity
                testID="settings-visibility-row"
                onPress={() => setShowVisibilityModal(true)}
                className={rowClass}
                activeOpacity={0.7}
              >
                <View className={rowIconContainer}>
                  <Eye size={16} color={Colors.accent} />
                </View>
                <Text className={rowLabelClass}>
                  Settlement visibility
                </Text>
                <Text className="font-body text-sm text-text-secondary capitalize mr-1">
                  {group?.settlement_visibility ?? 'public'}
                </Text>
                <ChevronRight size={16} color={theme.textTertiary} />
              </TouchableOpacity>

              <TouchableOpacity
                testID="settings-reset-invite-row"
                onPress={handleResetInvite}
                className={rowClass}
                activeOpacity={0.7}
                disabled={isResettingInvite}
              >
                <View className={rowIconContainer}>
                  {isResettingInvite ? (
                    <ActivityIndicator size="small" color={Colors.accent} />
                  ) : (
                    <Link size={16} color={theme.textSecondary} />
                  )}
                </View>
                <Text className={rowLabelClass}>Reset invite link</Text>
              </TouchableOpacity>

              {!isTrip && !isArchived && (
                <TouchableOpacity
                  testID="settings-archive-row"
                  onPress={handleArchive}
                  className={rowClass}
                  activeOpacity={0.7}
                  disabled={isArchiving}
                >
                  <View className={rowIconContainer}>
                    <Archive size={16} color={Colors.warning} />
                  </View>
                  <Text className={rowLabelClass} style={{ color: Colors.warning }}>
                    Archive group
                  </Text>
                </TouchableOpacity>
              )}

              {isArchived && (
                <TouchableOpacity
                  testID="settings-unarchive-row"
                  onPress={handleUnarchive}
                  className={rowClass}
                  activeOpacity={0.7}
                >
                  <View className={rowIconContainer}>
                    <ArchiveRestore size={16} color={Colors.accent} />
                  </View>
                  <Text className={rowLabelClass}>Unarchive group</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                testID="settings-delete-row"
                onPress={handleDelete}
                className={`${rowClass} border-b-0`}
                activeOpacity={0.7}
                disabled={isDeleting}
              >
                <View className={rowIconContainer}>
                  <Trash2 size={16} color={Colors.destructive} />
                </View>
                <Text className={rowLabelClass} style={{ color: Colors.destructive }}>
                  Delete group
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* Leave Group */}
        <Text className={sectionHeaderClass}>Account</Text>
        <View className="bg-surface rounded-2xl mx-4 border border-border overflow-hidden">
          <TouchableOpacity
            testID="settings-leave-row"
            onPress={handleLeave}
            className={`${rowClass} border-b-0`}
            activeOpacity={0.7}
            disabled={isLeaving}
          >
            <View className={rowIconContainer}>
              <LogOut size={16} color={Colors.destructive} />
            </View>
            <Text className={rowLabelClass} style={{ color: Colors.destructive }}>
              Leave group
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Rename Modal */}
      <Modal visible={showRenameModal} transparent animationType="slide" onRequestClose={() => setShowRenameModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
          <View className="flex-1 justify-end bg-black/60">
            <View className="bg-surface rounded-t-3xl p-6 pb-10">
              <Text className="font-display text-lg font-semibold text-text-primary mb-4">
                Change group name
              </Text>
              <TextInput
                testID="rename-modal-input"
                value={nameInput}
                onChangeText={setNameInput}
                placeholder="Group name"
                placeholderTextColor={theme.textTertiary}
                maxLength={30}
                className="bg-surface-2 border border-border rounded-xl px-4 py-3 font-body text-base text-text-primary mb-4"
                autoFocus
              />
              <View className="flex-row gap-3">
                <TouchableOpacity
                  testID="rename-modal-cancel"
                  onPress={() => setShowRenameModal(false)}
                  className="flex-1 border border-border rounded-full py-3 items-center"
                >
                  <Text className="font-body text-base text-text-primary">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  testID="rename-modal-save"
                  onPress={handleRename}
                  disabled={!nameInput.trim() || isRenaming}
                  className="flex-1 bg-accent rounded-full py-3 items-center"
                >
                  {isRenaming ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text className="font-body text-base font-semibold text-white">Save</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Settlement Visibility Modal */}
      <Modal
        testID="visibility-modal"
        visible={showVisibilityModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowVisibilityModal(false)}
      >
        <View className="flex-1 justify-end bg-black/60">
          <View className="bg-surface rounded-t-3xl p-6 pb-10">
            <Text className="font-display text-lg font-semibold text-text-primary mb-2">
              Settlement visibility
            </Text>
            <Text className="font-body text-sm text-text-secondary mb-6">
              Public: all members see settlements. Private: only the two parties see them.
            </Text>

            {(['public', 'private'] as const).map((option) => (
              <TouchableOpacity
                key={option}
                testID={`visibility-option-${option}`}
                onPress={() => handleVisibilitySelect(option)}
                disabled={isUpdatingVisibility}
                className={`flex-row items-center px-4 py-4 mb-3 rounded-2xl border ${
                  group?.settlement_visibility === option
                    ? 'border-accent bg-accent/10'
                    : 'border-border bg-surface-2'
                }`}
                activeOpacity={0.7}
              >
                <Text className="font-body text-base text-text-primary capitalize flex-1">
                  {option}
                </Text>
                {group?.settlement_visibility === option && (
                  <View className="w-5 h-5 rounded-full bg-accent" />
                )}
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              onPress={() => setShowVisibilityModal(false)}
              className="border border-border rounded-full py-3 items-center mt-2"
            >
              <Text className="font-body text-base text-text-primary">Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Extend Trip Date Modal */}
      <Modal
        visible={showExtendDateModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowExtendDateModal(false)}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
          <View className="flex-1 justify-end bg-black/60">
            <View className="bg-surface rounded-t-3xl p-6 pb-10">
              <Text className="font-display text-lg font-semibold text-text-primary mb-4">
                Extend end date
              </Text>
              <TextInput
                testID="extend-date-modal-input"
                value={endDateInput}
                onChangeText={setEndDateInput}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={theme.textTertiary}
                className="bg-surface-2 border border-border rounded-xl px-4 py-3 font-body text-base text-text-primary mb-4"
                autoFocus
                keyboardType="numeric"
              />
              <View className="flex-row gap-3">
                <TouchableOpacity
                  testID="extend-date-modal-cancel"
                  onPress={() => setShowExtendDateModal(false)}
                  className="flex-1 border border-border rounded-full py-3 items-center"
                >
                  <Text className="font-body text-base text-text-primary">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  testID="extend-date-modal-save"
                  onPress={handleExtendDate}
                  disabled={!endDateInput.trim() || isExtendingDate}
                  className="flex-1 bg-accent rounded-full py-3 items-center"
                >
                  {isExtendingDate ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text className="font-body text-base font-semibold text-white">Save</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
