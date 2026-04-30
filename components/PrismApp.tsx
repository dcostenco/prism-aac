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

  useEffect(() => {
    setHydrated(true);
    runDecay();
    seedTemplates();
  }, [runDecay, seedTemplates]);

  if (!hydrated) {
    return <div className="h-svh bg-[#12121e]" />;
  }

  return (
    <ErrorBoundary>
      <SyncProvider>
        <div className={`h-svh flex flex-col overflow-hidden ${highContrast ? 'high-contrast bg-black' : 'bg-[#12121e]'}`}>
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
