import { describe, expect, it } from 'vitest';
import { validatePasswordStrength } from '../../src/auth.js';

describe('password strength validation', () => {
  it('rejects short or weak passwords', () => {
    expect(validatePasswordStrength('short')).toContain('at least');
    expect(validatePasswordStrength('longbutmissingnumber!')).toContain('uppercase');
    expect(validatePasswordStrength('Longbutmissingnumber!')).toContain('number');
    expect(validatePasswordStrength('Longbutmissingnumber1')).toContain('symbol');
  });

  it('accepts a strong password', () => {
    expect(validatePasswordStrength('StrongPassphrase2026!')).toBeNull();
  });
});
