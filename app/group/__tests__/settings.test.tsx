import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Alert } from 'react-native';
import GroupSettingsScreen from '../[id]/settings';

const mockBack = jest.fn();
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockInvalidateQueries = jest.fn();
const mockRenameGroup = jest.fn();
const mockArchiveGroup = jest.fn();
const mockUnarchiveGroup = jest.fn();
const mockDeleteGroup = jest.fn();
const mockLeaveGroup = jest.fn();
const mockUploadGroupPhoto = jest.fn();
const mockUpdateSettlementVisibility = jest.fn();
const mockExtendTripEndDate = jest.fn();
const mockToggleMuteGroup = jest.fn();
const mockUseQuery = jest.fn();

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'group-1' }),
  useRouter: () => ({ back: mockBack, push: mockPush, replace: mockReplace }),
}));

jest.mock('../../../lib/repos/groups', () => ({
  fetchGroupDetail: jest.fn(),
  renameGroup: (...args: unknown[]) => mockRenameGroup(...args),
  archiveGroup: (...args: unknown[]) => mockArchiveGroup(...args),
  unarchiveGroup: (...args: unknown[]) => mockUnarchiveGroup(...args),
  deleteGroup: (...args: unknown[]) => mockDeleteGroup(...args),
  leaveGroup: (...args: unknown[]) => mockLeaveGroup(...args),
  uploadGroupPhoto: (...args: unknown[]) => mockUploadGroupPhoto(...args),
  updateSettlementVisibility: (...args: unknown[]) => mockUpdateSettlementVisibility(...args),
  extendTripEndDate: (...args: unknown[]) => mockExtendTripEndDate(...args),
  toggleMuteGroup: (...args: unknown[]) => mockToggleMuteGroup(...args),
}));

jest.mock('../../../lib/supabase', () => ({ supabase: {} }));

jest.mock('../../../store/auth', () => ({
  useAuthStore: () => ({
    session: { user: { id: 'user-1' } },
  }),
}));

jest.mock('../../../hooks/useNetworkStatus', () => ({
  useNetworkStatus: () => ({ isOnline: true }),
}));

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  launchImageLibraryAsync: jest.fn().mockResolvedValue({ canceled: true }),
}));

jest.mock('lucide-react-native', () => ({
  ArrowLeft: () => null,
  ChevronRight: () => null,
  Users: () => null,
  Bell: () => null,
  BellOff: () => null,
  ImageIcon: () => null,
  Share2: () => null,
  LogOut: () => null,
  Pencil: () => null,
  Calendar: () => null,
  Eye: () => null,
  Link: () => null,
  Archive: () => null,
  ArchiveRestore: () => null,
  Trash2: () => null,
}));

jest.mock('@tanstack/react-query', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useQueryClient: jest.fn(() => ({
    invalidateQueries: mockInvalidateQueries,
  })),
}));

jest.mock('nativewind', () => ({
  useColorScheme: () => ({ colorScheme: 'dark' }),
}));

const baseGroup = {
  id: 'group-1',
  name: 'Family Dinner',
  type: 'Home' as const,
  base_currency: 'USD' as const,
  admin_id: 'user-1',
  status: 'active' as const,
  start_date: null,
  end_date: null,
  settlement_visibility: 'public' as const,
  background_image_url: null,
  created_at: '2026-01-01',
  updated_at: '2026-01-01',
};

const adminDetail = {
  group: baseGroup,
  currentMemberId: 'member-1',
  currentMemberRole: 'admin' as const,
  currentMemberIsMuted: false,
  memberCount: 3,
  hasUnsettledBalances: false,
};

const memberDetail = {
  group: baseGroup,
  currentMemberId: 'member-2',
  currentMemberRole: 'member' as const,
  currentMemberIsMuted: false,
  memberCount: 3,
  hasUnsettledBalances: false,
};

const tripGroup = {
  ...baseGroup,
  type: 'Trip' as const,
  start_date: '2026-06-01',
  end_date: '2026-06-30',
};

const tripAdminDetail = {
  group: tripGroup,
  currentMemberId: 'member-1',
  currentMemberRole: 'admin' as const,
  currentMemberIsMuted: false,
  memberCount: 2,
  hasUnsettledBalances: false,
};

const archivedGroup = { ...baseGroup, status: 'archived' as const };
const archivedAdminDetail = {
  ...adminDetail,
  group: archivedGroup,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUseQuery.mockReturnValue({
    data: adminDetail,
    isLoading: false,
    isError: false,
    refetch: jest.fn(),
  });
  mockRenameGroup.mockResolvedValue(undefined);
  mockArchiveGroup.mockResolvedValue(undefined);
  mockUnarchiveGroup.mockResolvedValue(undefined);
  mockDeleteGroup.mockResolvedValue(undefined);
  mockLeaveGroup.mockResolvedValue(undefined);
});

describe('GroupSettingsScreen — rendering', () => {
  it('shows the group name in the header', () => {
    const { getByText } = render(<GroupSettingsScreen />);
    expect(getByText('Group Settings')).toBeTruthy();
  });

  it('shows Members row with count', () => {
    const { getByTestId } = render(<GroupSettingsScreen />);
    expect(getByTestId('settings-members-row')).toBeTruthy();
  });

  it('shows Leave group row', () => {
    const { getByTestId } = render(<GroupSettingsScreen />);
    expect(getByTestId('settings-leave-row')).toBeTruthy();
  });
});

describe('GroupSettingsScreen — admin visibility', () => {
  it('admin sees rename row', () => {
    const { getByTestId } = render(<GroupSettingsScreen />);
    expect(getByTestId('settings-rename-row')).toBeTruthy();
  });

  it('admin sees settlement visibility row', () => {
    const { getByTestId } = render(<GroupSettingsScreen />);
    expect(getByTestId('settings-visibility-row')).toBeTruthy();
  });

  it('admin sees archive row for non-Trip groups', () => {
    const { getByTestId } = render(<GroupSettingsScreen />);
    expect(getByTestId('settings-archive-row')).toBeTruthy();
  });

  it('admin sees delete row', () => {
    const { getByTestId } = render(<GroupSettingsScreen />);
    expect(getByTestId('settings-delete-row')).toBeTruthy();
  });

  it('non-admin does not see rename row', () => {
    mockUseQuery.mockReturnValue({ data: memberDetail, isLoading: false, isError: false, refetch: jest.fn() });
    const { queryByTestId } = render(<GroupSettingsScreen />);
    expect(queryByTestId('settings-rename-row')).toBeNull();
  });

  it('non-admin does not see archive row', () => {
    mockUseQuery.mockReturnValue({ data: memberDetail, isLoading: false, isError: false, refetch: jest.fn() });
    const { queryByTestId } = render(<GroupSettingsScreen />);
    expect(queryByTestId('settings-archive-row')).toBeNull();
  });

  it('non-admin does not see delete row', () => {
    mockUseQuery.mockReturnValue({ data: memberDetail, isLoading: false, isError: false, refetch: jest.fn() });
    const { queryByTestId } = render(<GroupSettingsScreen />);
    expect(queryByTestId('settings-delete-row')).toBeNull();
  });

  it('admin on Trip group sees extend date row instead of archive', () => {
    mockUseQuery.mockReturnValue({ data: tripAdminDetail, isLoading: false, isError: false, refetch: jest.fn() });
    const { getByTestId, queryByTestId } = render(<GroupSettingsScreen />);
    expect(getByTestId('settings-extend-date-row')).toBeTruthy();
    expect(queryByTestId('settings-archive-row')).toBeNull();
  });

  it('shows unarchive row for archived group', () => {
    mockUseQuery.mockReturnValue({ data: archivedAdminDetail, isLoading: false, isError: false, refetch: jest.fn() });
    const { getByTestId, queryByTestId } = render(<GroupSettingsScreen />);
    expect(getByTestId('settings-unarchive-row')).toBeTruthy();
    expect(queryByTestId('settings-archive-row')).toBeNull();
  });
});

describe('GroupSettingsScreen — rename', () => {
  it('rename row opens rename modal', () => {
    const { getByTestId } = render(<GroupSettingsScreen />);
    fireEvent.press(getByTestId('settings-rename-row'));
    expect(getByTestId('rename-modal-input')).toBeTruthy();
  });

  it('rename pre-fills with current group name', () => {
    const { getByTestId } = render(<GroupSettingsScreen />);
    fireEvent.press(getByTestId('settings-rename-row'));
    expect(getByTestId('rename-modal-input').props.value).toBe('Family Dinner');
  });

  it('rename save calls renameGroup with new name', async () => {
    const { getByTestId } = render(<GroupSettingsScreen />);
    fireEvent.press(getByTestId('settings-rename-row'));
    fireEvent.changeText(getByTestId('rename-modal-input'), 'New Name');
    fireEvent.press(getByTestId('rename-modal-save'));
    await waitFor(() => {
      expect(mockRenameGroup).toHaveBeenCalledWith({}, 'group-1', 'New Name');
    });
  });

  it('rename save invalidates group queries', async () => {
    const { getByTestId } = render(<GroupSettingsScreen />);
    fireEvent.press(getByTestId('settings-rename-row'));
    fireEvent.changeText(getByTestId('rename-modal-input'), 'New Name');
    fireEvent.press(getByTestId('rename-modal-save'));
    await waitFor(() => {
      expect(mockInvalidateQueries).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: expect.arrayContaining(['group', 'group-1']) })
      );
    });
  });

  it('rename cancel closes modal without saving', () => {
    const { getByTestId, queryByTestId } = render(<GroupSettingsScreen />);
    fireEvent.press(getByTestId('settings-rename-row'));
    fireEvent.press(getByTestId('rename-modal-cancel'));
    expect(queryByTestId('rename-modal-input')).toBeNull();
    expect(mockRenameGroup).not.toHaveBeenCalled();
  });
});

describe('GroupSettingsScreen — archive', () => {
  it('archive row shows confirmation alert', () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    const { getByTestId } = render(<GroupSettingsScreen />);
    fireEvent.press(getByTestId('settings-archive-row'));
    expect(alertSpy).toHaveBeenCalledWith(
      expect.stringContaining('Archive'),
      expect.any(String),
      expect.any(Array),
    );
  });

  it('confirming archive calls archiveGroup', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    const { getByTestId } = render(<GroupSettingsScreen />);
    fireEvent.press(getByTestId('settings-archive-row'));
    const [,, buttons] = alertSpy.mock.calls[0] as [string, string, { text: string; onPress?: () => void }[]];
    await act(async () => { buttons.find((b) => b.text === 'Archive')?.onPress?.(); });
    await waitFor(() => {
      expect(mockArchiveGroup).toHaveBeenCalledWith({}, 'group-1');
    });
  });

  it('cancelling archive does not call archiveGroup', () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    const { getByTestId } = render(<GroupSettingsScreen />);
    fireEvent.press(getByTestId('settings-archive-row'));
    const [,, buttons] = alertSpy.mock.calls[0] as [string, string, { text: string; onPress?: () => void }[]];
    buttons.find((b) => b.text === 'Cancel')?.onPress?.();
    expect(mockArchiveGroup).not.toHaveBeenCalled();
  });
});

describe('GroupSettingsScreen — delete (no unsettled balances)', () => {
  it('delete row shows first confirmation alert', () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    const { getByTestId } = render(<GroupSettingsScreen />);
    fireEvent.press(getByTestId('settings-delete-row'));
    expect(alertSpy).toHaveBeenCalled();
  });

  it('confirming delete calls deleteGroup', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    const { getByTestId } = render(<GroupSettingsScreen />);
    fireEvent.press(getByTestId('settings-delete-row'));
    const [,, buttons] = alertSpy.mock.calls[0] as [string, string, { text: string; onPress?: () => void }[]];
    await act(async () => { buttons.find((b) => b.text === 'Delete')?.onPress?.(); });
    await waitFor(() => {
      expect(mockDeleteGroup).toHaveBeenCalledWith({}, 'group-1');
    });
  });
});

describe('GroupSettingsScreen — delete (unsettled balances)', () => {
  const detailWithBalances = { ...adminDetail, hasUnsettledBalances: true };

  it('shows double confirmation when unsettled balances exist', async () => {
    mockUseQuery.mockReturnValue({ data: detailWithBalances, isLoading: false, isError: false, refetch: jest.fn() });
    const alertSpy = jest.spyOn(Alert, 'alert');
    const { getByTestId } = render(<GroupSettingsScreen />);
    fireEvent.press(getByTestId('settings-delete-row'));
    expect(alertSpy).toHaveBeenCalledTimes(1);
    // Confirm first alert
    const [,, buttons1] = alertSpy.mock.calls[0] as [string, string, { text: string; onPress?: () => void }[]];
    buttons1.find((b) => b.text === 'Continue')?.onPress?.();
    expect(alertSpy).toHaveBeenCalledTimes(2);
    // Confirm second alert
    const [,, buttons2] = alertSpy.mock.calls[1] as [string, string, { text: string; onPress?: () => void }[]];
    await act(async () => { buttons2.find((b) => b.text === 'Yes, delete')?.onPress?.(); });
    await waitFor(() => {
      expect(mockDeleteGroup).toHaveBeenCalledWith({}, 'group-1');
    });
  });
});

describe('GroupSettingsScreen — leave group', () => {
  it('leave row shows confirmation alert', () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    const { getByTestId } = render(<GroupSettingsScreen />);
    fireEvent.press(getByTestId('settings-leave-row'));
    expect(alertSpy).toHaveBeenCalled();
  });

  it('confirming leave calls leaveGroup', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    const { getByTestId } = render(<GroupSettingsScreen />);
    fireEvent.press(getByTestId('settings-leave-row'));
    const [,, buttons] = alertSpy.mock.calls[0] as [string, string, { text: string; onPress?: () => void }[]];
    await act(async () => { buttons.find((b) => b.text === 'Leave')?.onPress?.(); });
    await waitFor(() => {
      expect(mockLeaveGroup).toHaveBeenCalledWith({}, 'group-1', 'member-1', true);
    });
  });
});

describe('GroupSettingsScreen — settlement visibility', () => {
  it('visibility row opens visibility modal', () => {
    const { getByTestId } = render(<GroupSettingsScreen />);
    fireEvent.press(getByTestId('settings-visibility-row'));
    expect(getByTestId('visibility-modal')).toBeTruthy();
  });

  it('selecting Private calls updateSettlementVisibility', async () => {
    const { getByTestId } = render(<GroupSettingsScreen />);
    fireEvent.press(getByTestId('settings-visibility-row'));
    fireEvent.press(getByTestId('visibility-option-private'));
    await waitFor(() => {
      expect(mockUpdateSettlementVisibility).toHaveBeenCalledWith({}, 'group-1', 'private');
    });
  });
});

describe('GroupSettingsScreen — extend trip date', () => {
  it('extend date row opens extend date modal', () => {
    mockUseQuery.mockReturnValue({ data: tripAdminDetail, isLoading: false, isError: false, refetch: jest.fn() });
    const { getByTestId } = render(<GroupSettingsScreen />);
    fireEvent.press(getByTestId('settings-extend-date-row'));
    expect(getByTestId('extend-date-modal-input')).toBeTruthy();
  });

  it('extend date save calls extendTripEndDate', async () => {
    mockUseQuery.mockReturnValue({ data: tripAdminDetail, isLoading: false, isError: false, refetch: jest.fn() });
    const { getByTestId } = render(<GroupSettingsScreen />);
    fireEvent.press(getByTestId('settings-extend-date-row'));
    fireEvent.changeText(getByTestId('extend-date-modal-input'), '2026-12-31');
    fireEvent.press(getByTestId('extend-date-modal-save'));
    await waitFor(() => {
      expect(mockExtendTripEndDate).toHaveBeenCalledWith({}, 'group-1', '2026-12-31');
    });
  });
});

describe('GroupSettingsScreen — members navigation', () => {
  it('tapping Members row navigates to members screen', () => {
    const { getByTestId } = render(<GroupSettingsScreen />);
    fireEvent.press(getByTestId('settings-members-row'));
    expect(mockPush).toHaveBeenCalledWith('/group/group-1/members');
  });
});
