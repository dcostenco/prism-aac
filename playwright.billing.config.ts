import { defineConfig } from '@playwright/test';
import preview from './playwright.web-preview.config';

export default defineConfig({ ...preview,
  testMatch: ['cloud-trial-disclosures.spec.ts', 'cloud-subscription-summary.spec.ts'],
});
