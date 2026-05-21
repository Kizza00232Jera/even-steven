import { Colors } from '../colors';

describe('Colors', () => {
  it('has correct accent color', () => {
    expect(Colors.accent).toBe('#00C896');
  });

  it('has correct destructive color', () => {
    expect(Colors.destructive).toBe('#FF4444');
  });

  it('has correct dark background', () => {
    expect(Colors.dark.background).toBe('#0b0b0b');
  });

  it('has correct light background', () => {
    expect(Colors.light.background).toBe('#f8f8f8');
  });

  it('has correct dark surface', () => {
    expect(Colors.dark.surface).toBe('#1a1a1a');
  });

  it('has gradient entries for all group types', () => {
    const types = ['trip', 'home', 'couple', 'utilities', 'family', 'other'] as const;
    types.forEach((type) => {
      expect(Colors.gradients[type]).toHaveLength(2);
    });
  });
});
