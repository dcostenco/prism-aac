'use client';
import { useEffect, useState, Component, ReactNode } from 'react';
import Toolbar from './Toolbar';
import MessageBar from './MessageBar';
import PredictionBar from './PredictionBar';
import Keyboard from './Keyboard';
import CategoryPanel from './CategoryPanel';
import HistoryModal from './HistoryModal';
import SettingsModal from './SettingsModal';
import AlertOverlay from './AlertOverlay';
import SyncProvider from './SyncProvider';
import { usePredictionStore } from '@/store/predictionStore';

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

  useEffect(() => {
    setHydrated(true);
    runDecay();
  }, [runDecay]);

  if (!hydrated) {
    return <div className="h-svh bg-[#12121e]" />;
  }

  return (
    <ErrorBoundary>
      <SyncProvider>
        <div className="h-svh flex flex-col bg-[#12121e] overflow-hidden">
          <Toolbar />
          <MessageBar />
          <PredictionBar />
          <div className="flex-1 flex flex-row min-h-0">
            <CategoryPanel />
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
