import { uploadProfilePhoto } from '../profiles';
import { uploadGroupPhoto } from '../groups';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../database.types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PUBLIC_URL = 'https://storage.example.com/profile-photos/avatars/user-1.jpg';
const GROUP_PUBLIC_URL = 'https://storage.example.com/group-photos/groups/group-1.jpg';
const FAKE_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

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
  rpcResult = { error: null },
) {
  const rpcFn = jest.fn().mockResolvedValue(rpcResult);
  return {
    storage: {
      from: jest.fn().mockReturnValue(bucketMock),
    },
    rpc: rpcFn,
    _rpcFn: rpcFn,
  } as unknown as SupabaseClient<Database> & { _rpcFn: jest.Mock };
}

// ---------------------------------------------------------------------------
// uploadProfilePhoto
// ---------------------------------------------------------------------------

describe('uploadProfilePhoto', () => {
  it('uploads to the profile-photos bucket', async () => {
    const bucket = makeStorageBucket(PUBLIC_URL);
    const client = makeProfileClient(bucket);
    await uploadProfilePhoto(client, 'user-1', 'https://example.com/photo.jpg', FAKE_BASE64);
    expect(client.storage.from).toHaveBeenCalledWith('profile-photos');
    expect(bucket.upload).toHaveBeenCalledWith(
      'avatars/user-1.jpg',
      expect.any(ArrayBuffer),
      expect.objectContaining({ upsert: true }),
    );
  });

  it('returns a public URL string', async () => {
    const client = makeProfileClient();
    const result = await uploadProfilePhoto(client, 'user-1', 'https://example.com/photo.jpg', FAKE_BASE64);
    expect(result).toMatch(/^https:\/\/storage\.example\.com\/profile-photos\/avatars\/user-1\.jpg/);
  });

  it('uses mimeType when provided', async () => {
    const bucket = makeStorageBucket(PUBLIC_URL);
    const client = makeProfileClient(bucket);
    await uploadProfilePhoto(client, 'user-1', 'https://example.com/photo.jpg', FAKE_BASE64, 'image/png');
    expect(bucket.upload).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(ArrayBuffer),
      expect.objectContaining({ contentType: 'image/png' }),
    );
  });

  it('throws when the bucket upload fails', async () => {
    const bucket = makeStorageBucket(PUBLIC_URL);
    bucket.upload = jest.fn().mockResolvedValue({ error: new Error('bucket not found') });
    const client = makeProfileClient(bucket);
    await expect(
      uploadProfilePhoto(client, 'user-1', 'https://example.com/photo.jpg', FAKE_BASE64),
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
    await uploadGroupPhoto(client, 'group-1', 'https://example.com/photo.jpg', FAKE_BASE64);
    expect(client.storage.from).toHaveBeenCalledWith('group-photos');
    expect(bucket.upload).toHaveBeenCalledWith(
      'groups/group-1.jpg',
      expect.any(ArrayBuffer),
      expect.objectContaining({ upsert: true }),
    );
  });

  it('returns a public URL string', async () => {
    const client = makeGroupClient();
    const result = await uploadGroupPhoto(client, 'group-1', 'https://example.com/photo.jpg', FAKE_BASE64);
    expect(result).toMatch(/^https:\/\/storage\.example\.com\/group-photos\/groups\/group-1\.jpg/);
  });

  it('calls rpc to update the groups table with the photo URL', async () => {
    const client = makeGroupClient();
    const result = await uploadGroupPhoto(client, 'group-1', 'https://example.com/photo.jpg', FAKE_BASE64);
    expect((client as unknown as { _rpcFn: jest.Mock })._rpcFn).toHaveBeenCalledWith(
      'update_group_background_image',
      expect.objectContaining({ p_group_id: 'group-1', p_url: expect.stringContaining(result.split('?')[0]) }),
    );
  });

  it('throws when the bucket upload fails', async () => {
    const bucket = makeStorageBucket(GROUP_PUBLIC_URL);
    bucket.upload = jest.fn().mockResolvedValue({ error: new Error('bucket not found') });
    const client = makeGroupClient(bucket);
    await expect(
      uploadGroupPhoto(client, 'group-1', 'https://example.com/photo.jpg', FAKE_BASE64),
    ).rejects.toThrow('bucket not found');
  });

  it('throws when the rpc call fails', async () => {
    const client = makeGroupClient(makeStorageBucket(GROUP_PUBLIC_URL), {
      error: new Error('update failed'),
    });
    await expect(
      uploadGroupPhoto(client, 'group-1', 'https://example.com/photo.jpg', FAKE_BASE64),
    ).rejects.toThrow('update failed');
  });
});
