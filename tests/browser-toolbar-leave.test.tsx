import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import BrowserToolbar from '@/app/browser/BrowserToolbar';
import { PRISM_AAC_BASE_PATH } from '@/lib/appPaths';

// "Back to AAC Board" assigned window.location.href = '/'. A raw href skips the
// Next base path, so the button left the app for the synalux.ai home page
// ("Operational Software for Health & Hospitality"), with no way back from
// inside the iOS shell.

const realLocation = window.location;
beforeEach(() => {
  Object.defineProperty(window, 'location', {
    configurable: true, writable: true,
    value: { ...realLocation, href: 'https://synalux.ai/prism-aac/browser', pathname: '/prism-aac/browser' },
  });
});
afterEach(() => {
  Object.defineProperty(window, 'location', { configurable: true, writable: true, value: realLocation });
});

describe('Back to AAC Board', () => {
  it('leaves for the AAC board under the app base path, not the site root', () => {
    render(<BrowserToolbar />);
    fireEvent.click(screen.getByRole('button', { name: 'Back to AAC Board' }));
    fireEvent.click(screen.getByRole('button', { name: 'Leave' }));
    expect(window.location.href).toBe(PRISM_AAC_BASE_PATH);
  });

  it('stays on the browser when Stay is chosen', () => {
    render(<BrowserToolbar />);
    fireEvent.click(screen.getByRole('button', { name: 'Back to AAC Board' }));
    fireEvent.click(screen.getByRole('button', { name: 'Stay' }));
    expect(window.location.href).toBe('https://synalux.ai/prism-aac/browser');
  });
});
