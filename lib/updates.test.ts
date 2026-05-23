import { compareVersions, isVersionBelowMinimum } from './updates';

describe('compareVersions', () => {
  it('returns 0 for equal versions', () => {
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
  });

  it('returns negative when a < b (major)', () => {
    expect(compareVersions('1.0.0', '2.0.0')).toBeLessThan(0);
  });

  it('returns positive when a > b (major)', () => {
    expect(compareVersions('2.0.0', '1.0.0')).toBeGreaterThan(0);
  });

  it('returns negative when a < b (minor)', () => {
    expect(compareVersions('1.2.0', '1.3.0')).toBeLessThan(0);
  });

  it('returns positive when a > b (minor)', () => {
    expect(compareVersions('1.3.0', '1.2.0')).toBeGreaterThan(0);
  });

  it('returns negative when a < b (patch)', () => {
    expect(compareVersions('1.0.1', '1.0.2')).toBeLessThan(0);
  });

  it('returns positive when a > b (patch)', () => {
    expect(compareVersions('1.0.2', '1.0.1')).toBeGreaterThan(0);
  });

  it('handles double-digit version segments', () => {
    expect(compareVersions('1.10.0', '1.9.0')).toBeGreaterThan(0);
  });
});

describe('isVersionBelowMinimum', () => {
  it('returns false when running equals minimum', () => {
    expect(isVersionBelowMinimum('1.0.0', '1.0.0')).toBe(false);
  });

  it('returns false when running is above minimum', () => {
    expect(isVersionBelowMinimum('2.0.0', '1.0.0')).toBe(false);
  });

  it('returns true when running is below minimum (major)', () => {
    expect(isVersionBelowMinimum('1.0.0', '2.0.0')).toBe(true);
  });

  it('returns true when running is below minimum (minor)', () => {
    expect(isVersionBelowMinimum('1.2.0', '1.3.0')).toBe(true);
  });

  it('returns true when running is below minimum (patch)', () => {
    expect(isVersionBelowMinimum('1.0.0', '1.0.1')).toBe(true);
  });

  it('returns false when minimum is null (no gate configured)', () => {
    expect(isVersionBelowMinimum('1.0.0', null)).toBe(false);
  });

  it('returns false when running version is null (unknown build)', () => {
    expect(isVersionBelowMinimum(null, '1.0.0')).toBe(false);
  });
});
