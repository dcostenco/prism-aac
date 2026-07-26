'use client';

import { useEffect, useRef } from 'react';
import {
  anonymousDatadogUserId,
  initDatadog,
  ddSetUser,
  ddAction,
} from '@/lib/datadog';
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
        const { email, plan } = state.profile;
        // Preserve affected-user counts without sending a reversible email
        // prefix or other account identity to Datadog.
        void anonymousDatadogUserId(email).then((anonId) => {
          if (!anonId) return;
          ddSetUser({
            id: anonId,
            plan,
          });
        });
        ddAction('user.identified', { plan });
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
