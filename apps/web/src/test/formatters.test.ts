import { describe, it, expect } from 'vitest';
import {
  formatDate,
  formatRelativeTime,
  formatCoords,
  formatPercentage,
  formatDurationMs,
} from '../lib/formatters';

describe('Operations Data Formatters', () => {
  it('formats dates into readable human strings', () => {
    const iso = '2026-10-08T15:30:00.000Z';
    const formatted = formatDate(iso);
    expect(formatted).toContain('Oct');
    expect(formatDate(null)).toBe('—');
  });

  it('formats relative time accurately', () => {
    const justNow = new Date().toISOString();
    expect(formatRelativeTime(justNow)).toBe('Just now');

    const oneHourAgo = new Date(Date.now() - 3600 * 1000).toISOString();
    expect(formatRelativeTime(oneHourAgo)).toBe('1h ago');

    const twoDaysAgo = new Date(Date.now() - 2 * 86400 * 1000).toISOString();
    expect(formatRelativeTime(twoDaysAgo)).toBe('2d ago');

    expect(formatRelativeTime(null)).toBe('—');
  });

  it('formats coordinates to 4 decimal precision with hemisphere indicators', () => {
    expect(formatCoords(18.5204321, 73.8567432)).toBe('18.5204°N, 73.8567°E');
    expect(formatCoords(undefined, undefined)).toBe('—');
  });

  it('formats percentages correctly rounded to integer', () => {
    expect(formatPercentage(0.854)).toBe('85%');
    expect(formatPercentage(0.92)).toBe('92%');
    expect(formatPercentage(null as any)).toBe('0%');
  });

  it('formats durations in milliseconds or seconds', () => {
    expect(formatDurationMs(450)).toBe('450ms');
    expect(formatDurationMs(2500)).toBe('2.50s');
    expect(formatDurationMs(null as any)).toBe('—');
  });
});
