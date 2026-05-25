import { uploadProfilePhoto } from '../profiles';
import { uploadGroupPhoto } from '../groups';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../database.types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PUBLIC_URL = 'https://storage.example.com/profile-photos/avatars/user-1.jpg';
const GROUP_PUBLIC_URL = 'https://storage.example.com/group-photos/groups/group-1.jpg';

function makeStorageBucket(publicUrl: string) {
  return {
    upload: jest.fn().mockResolvedValue({ error: null }),
    getPublicUrl: jest.fn().mockReturnValue({ data: { publicUrl } }),
  };
}

function makeProfileClient(bucketMock = makeStorageBucket(PUBLIC_URL)) {
  return {
    storage: {
      from: jest.fn().mockReturnValue(bucketMock),
    },
  } as unknown as SupabaseClient<Database>;
}

function makeGroupClient(
  bucketMock = makeStorageBucket(GROUP_PUBLIC_URL),
  updateResult = { error: null },
) {
  const updateFn = jest.fn().mockReturnValue({
    eq: jest.fn().mockResolvedValue(updateResult),
  });
  return {
    storage: {
      from: jest.fn().mockReturnValue(bucketMock),
    },
    from: jest.fn().mockReturnValue({ update: updateFn }),
    _updateFn: updateFn,
  } as unknown as SupabaseClient<Database> & { _updateFn: jest.Mock };
}

// Mock fetch + blob globally
const mockBlob = { type: 'image/jpeg' } as Blob;
beforeAll(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).fetch = jest.fn().mockResolvedValue({
    blob: () => Promise.resolve(mockBlob),
  } as Response);
});

afterAll(() => {
  jest.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// uploadProfilePhoto
// ---------------------------------------------------------------------------

describe('uploadProfilePhoto', () => {
  it('uploads to the profile-photos bucket', async () => {
    const bucket = makeStorageBucket(PUBLIC_URL);
    const client = makeProfileClient(bucket);
    await uploadProfilePhoto(client, 'user-1', 'https://example.com/photo.jpg');
    expect(client.storage.from).toHaveBeenCalledWith('profile-photos');
    expect(bucket.upload).toHaveBeenCalledWith(
      'avatars/user-1.jpg',
      mockBlob,
      expect.objectContaining({ upsert: true }),
    );
  });

  it('returns a public URL string', async () => {
    const client = makeProfileClient();
    const result = await uploadProfilePhoto(client, 'user-1', 'https://example.com/photo.jpg');
    expect(result).toMatch(/^https:\/\/storage\.example\.com\/profile-photos\/avatars\/user-1\.jpg/);
  });

  it('throws when the bucket upload fails', async () => {
    const bucket = makeStorageBucket(PUBLIC_URL);
    bucket.upload = jest.fn().mockResolvedValue({ error: new Error('bucket not found') });
    const client = makeProfileClient(bucket);
    await expect(
      uploadProfilePhoto(client, 'user-1', 'https://example.com/photo.jpg'),
    ).rejects.toThrow('bucket not found');
  });
});

// ---------------------------------------------------------------------------
// uploadGroupPhoto
// ---------------------------------------------------------------------------

describe('uploadGroupPhoto', () => {
  it('uploads to the group-photos bucket', async () => {
    const bucket = makeStorageBucket(GROUP_PUBLIC_URL);
    const client = makeGroupClient(bucket);
    await uploadGroupPhoto(client, 'group-1', 'https://example.com/photo.jpg');
    expect(client.storage.from).toHaveBeenCalledWith('group-photos');
    expect(bucket.upload).toHaveBeenCalledWith(
      'groups/group-1.jpg',
      mockBlob,
      expect.objectContaining({ upsert: true }),
    );
  });

  it('returns a public URL string', async () => {
    const client = makeGroupClient();
    const result = await uploadGroupPhoto(client, 'group-1', 'https://example.com/photo.jpg');
    expect(result).toMatch(/^https:\/\/storage\.example\.com\/group-photos\/groups\/group-1\.jpg/);
  });

  it('saves the photo URL to the groups table', async () => {
    const client = makeGroupClient();
    const result = await uploadGroupPhoto(client, 'group-1', 'https://example.com/photo.jpg');
    expect((client as unknown as { _updateFn: jest.Mock })._updateFn).toHaveBeenCalledWith(
      expect.objectContaining({ background_image_url: result }),
    );
  });

  it('throws when the bucket upload fails', async () => {
    const bucket = makeStorageBucket(GROUP_PUBLIC_URL);
    bucket.upload = jest.fn().mockResolvedValue({ error: new Error('bucket not found') });
    const client = makeGroupClient(bucket);
    await expect(
      uploadGroupPhoto(client, 'group-1', 'https://example.com/photo.jpg'),
    ).rejects.toThrow('bucket not found');
  });

  it('throws when the groups table update fails', async () => {
    const client = makeGroupClient(makeStorageBucket(GROUP_PUBLIC_URL), {
      error: new Error('update failed') as unknown as null,
    });
    await expect(
      uploadGroupPhoto(client, 'group-1', 'https://example.com/photo.jpg'),
    ).rejects.toThrow('update failed');
  });
});
