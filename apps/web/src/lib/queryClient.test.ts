import { describe, it, expect } from 'vitest';
import { createQueryClient, API_BASE } from './queryClient';

describe('queryClient', () => {
  it('tạo được QueryClient', () => {
    expect(createQueryClient()).toBeDefined();
  });

  it('API_BASE trỏ tới /api', () => {
    expect(API_BASE).toBe('/api');
  });
});
