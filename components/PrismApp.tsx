'use client';
import { useEffect, useState, Component, ReactNode } from 'react';
import Toolbar from './Toolbar';
import MessageBar from './MessageBar';
import PredictionBar from './PredictionBar';
import Keyboard from './Keyboard';
import CategoryPanel from './CategoryPanel';
import CaregiverPanel from './CaregiverPanel';
import AIChatPanel from './AIChatPanel';
import HistoryModal from './HistoryModal';
import SettingsModal from './SettingsModal';
import AlertOverlay from './AlertOverlay';
import SyncProvider from './SyncProvider';
import { usePredictionStore } from '@/store/predictionStore';
import { useCategoryStore } from '@/store/categoryStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useMessageStore } from '@/store/messageStore';
import { keyFeedback, deleteFeedback } from '@/services/feedback';
import { useT } from '@/engine/useT';

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div className="h-svh flex flex-col items-center justify-center bg-[#12121e] p-8 text-center">
          <p className="text-[#F44336] text-2xl font-bold mb-4">Something went wrong</p>
          <p className="text-[#888] mb-6">{this.state.error.message}</p>
          <button onClick={() => window.location.reload()} className="bg-[#4CAF50] text-white px-8 py-3 rounded-xl text-lg font-semibold">
            Tap to reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function PrismApp() {
  const runDecay = usePredictionStore((s) => s.runDecay);
  const [hydrated, setHydrated] = useState(false);

  const seedTemplates = useCategoryStore((s) => s.seedTemplates);
  const highContrast = useSettingsStore((s) => s.highContrast);
  const { rtl } = useT();

  useEffect(() => {
    setHydrated(true);
    runDecay();
    seedTemplates();
  }, [runDecay, seedTemplates]);

  // Physical keyboard support — captures keystrokes globally
  // Skips interactive form elements (input, textarea, select, buttons with focus)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'Tab' || e.key === 'Escape') return;
      if ((e.target as HTMLElement)?.closest('[role="dialog"]')) return;
      if (e.key === ' ' && document.activeElement?.tagName === 'BUTTON') return;
      const store = useMessageStore.getState();
      if (e.key === 'Backspace') { e.preventDefault(); deleteFeedback(); store.deleteLastChar(); }
      else if (e.key === 'Enter') { e.preventDefault(); }
      else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) { e.preventDefault(); keyFeedback(); store.appendChar(e.key); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  if (!hydrated) {
    return <div className="h-svh bg-[#12121e]" />;
  }

  return (
    <ErrorBoundary>
      <SyncProvider>
        <div dir={rtl ? 'rtl' : 'ltr'} className={`h-svh flex flex-col overflow-hidden ${highContrast ? 'high-contrast bg-black' : 'bg-[#12121e]'}`}>
          <Toolbar />
          <MessageBar />
          <PredictionBar />
          <div className="flex-1 flex flex-row min-h-0">
            <CategoryPanel />
            <CaregiverPanel />
            <AIChatPanel />
            <Keyboard />
          </div>
          <AlertOverlay />
          <HistoryModal />
          <SettingsModal />
        </div>
      </SyncProvider>
    </ErrorBoundary>
  );
}
