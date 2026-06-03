'use client';

import { useEffect, useRef } from 'react';
import { initDatadog, ddSetUser, ddAction } from '@/lib/datadog';
import { useAuthStore } from '@/store/authStore';
import { useSettingsStore } from '@/store/settingsStore';
import { subscribeTrackingEvents } from '@/services/trackingTelemetry';

export default function DatadogInit() {
  const trackingUnsub = useRef<(() => void) | null>(null);

  useEffect(() => {
    initDatadog();

    trackingUnsub.current = subscribeTrackingEvents((event) => {
      ddAction(`tracking.${event.type}`, event as unknown as Record<string, unknown>);
    });

    return () => { trackingUnsub.current?.(); };
  }, []);

  useEffect(() => {
    return useAuthStore.subscribe((state) => {
      if (state.profile) {
        // Don't send email/name to Datadog — use anonymous hash to avoid
        // linking PII to AAC communication patterns (PHI risk).
        const anonId = btoa(state.profile.email).slice(0, 12);
        ddSetUser({
          id: anonId,
          plan: state.profile.plan,
        });
        ddAction('user.identified', { plan: state.profile.plan });
      }
    });
  }, []);

  useEffect(() => {
    let prev = useSettingsStore.getState().language;
    return useSettingsStore.subscribe((state) => {
      if (state.language !== prev) {
        prev = state.language;
        ddAction('settings.language_change', { language: state.language });
      }
    });
  }, []);

  return null;
}
