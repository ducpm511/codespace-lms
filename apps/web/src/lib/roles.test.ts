import { describe, it, expect } from 'vitest';
import { primaryArea, allowedAreas } from './roles';

describe('roles', () => {
  it('primaryArea: admin > teach > learn', () => {
    expect(primaryArea(['super_admin'])).toBe('admin');
    expect(primaryArea(['admin', 'student'])).toBe('admin');
    expect(primaryArea(['instructor'])).toBe('teach');
    expect(primaryArea(['student'])).toBe('learn');
    expect(primaryArea([])).toBe('learn');
  });

  it('allowedAreas: instructor vào được teach và learn', () => {
    expect(allowedAreas(['instructor']).sort()).toEqual(['learn', 'teach']);
    expect(allowedAreas(['student'])).toEqual(['learn']);
    expect(allowedAreas(['admin']).sort()).toEqual(['admin', 'learn']);
    // User chưa có role (mới enroll) vẫn vào được learn.
    expect(allowedAreas([])).toEqual(['learn']);
  });
});
