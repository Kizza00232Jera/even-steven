import { resolveDisplayName, resolveAvatarUrl } from './displayName';

describe('resolveDisplayName', () => {
  it('returns group display name when all sources are provided', () => {
    expect(resolveDisplayName('Group Nick', 'Account Name', 'Gmail Name', 'a@b.com')).toBe('Group Nick');
  });

  it('falls back to account display name when group name is null', () => {
    expect(resolveDisplayName(null, 'Account Name', 'Gmail Name', 'a@b.com')).toBe('Account Name');
  });

  it('falls back to account display name when group name is undefined', () => {
    expect(resolveDisplayName(undefined, 'Account Name', 'Gmail Name', 'a@b.com')).toBe('Account Name');
  });

  it('falls back to account display name when group name is empty string', () => {
    expect(resolveDisplayName('', 'Account Name', 'Gmail Name', 'a@b.com')).toBe('Account Name');
  });

  it('falls back to account display name when group name is whitespace only', () => {
    expect(resolveDisplayName('   ', 'Account Name', 'Gmail Name', 'a@b.com')).toBe('Account Name');
  });

  it('falls back to gmail name when group and account names are null', () => {
    expect(resolveDisplayName(null, null, 'Gmail Name', 'a@b.com')).toBe('Gmail Name');
  });

  it('falls back to gmail name when group name is null and account name is empty', () => {
    expect(resolveDisplayName(null, '', 'Gmail Name', 'a@b.com')).toBe('Gmail Name');
  });

  it('falls back to email when all name sources are null', () => {
    expect(resolveDisplayName(null, null, null, 'a@b.com')).toBe('a@b.com');
  });

  it('falls back to email when all name sources are undefined', () => {
    expect(resolveDisplayName(undefined, undefined, undefined, 'a@b.com')).toBe('a@b.com');
  });

  it('trims group display name', () => {
    expect(resolveDisplayName('  Group Nick  ', 'Account Name', 'Gmail Name', 'a@b.com')).toBe('Group Nick');
  });

  it('trims account display name in fallback', () => {
    expect(resolveDisplayName(null, '  Account Name  ', 'Gmail Name', 'a@b.com')).toBe('Account Name');
  });

  it('trims gmail name in fallback', () => {
    expect(resolveDisplayName(null, null, '  Gmail Name  ', 'a@b.com')).toBe('Gmail Name');
  });
});

describe('resolveAvatarUrl', () => {
  it('returns custom avatar when provided', () => {
    expect(resolveAvatarUrl('custom.jpg', 'google.jpg')).toBe('custom.jpg');
  });

  it('falls back to google avatar when custom is null', () => {
    expect(resolveAvatarUrl(null, 'google.jpg')).toBe('google.jpg');
  });

  it('falls back to google avatar when custom is undefined', () => {
    expect(resolveAvatarUrl(undefined, 'google.jpg')).toBe('google.jpg');
  });

  it('returns null when both are null', () => {
    expect(resolveAvatarUrl(null, null)).toBeNull();
  });

  it('returns null when both are undefined', () => {
    expect(resolveAvatarUrl(undefined, undefined)).toBeNull();
  });
});
