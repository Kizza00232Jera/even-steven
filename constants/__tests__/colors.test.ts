import { Colors } from '../colors';

describe('Colors', () => {
  it('has correct accent color', () => {
    expect(Colors.accent).toBe('#00C896');
  });

  it('has correct destructive color', () => {
    expect(Colors.destructive).toBe('#FF4444');
  });

  it('has correct dark background', () => {
    expect(Colors.dark.background).toBe('#0f0e0d');
  });

  it('has correct light background', () => {
    expect(Colors.light.background).toBe('#f5f3f0');
  });

  it('has correct dark surface', () => {
    expect(Colors.dark.surface).toBe('#1c1a18');
  });

  it('has gradient entries for all group types', () => {
    const types = ['trip', 'home', 'couple', 'utilities', 'family', 'other'] as const;
    types.forEach((type) => {
      expect(Colors.gradients[type]).toHaveLength(2);
    });
  });
});
