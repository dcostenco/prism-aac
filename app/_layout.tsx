import React, { useEffect, useState, Component, ReactNode } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { Slot } from 'expo-router';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import '../i18n';
import { getDatabase } from '../db/schema';
import { seedDatabase } from '../db/seed';
import { runStartupDecay } from '../engine/predictionEngine';
import { useSettingsStore } from '../store/settingsStore';
import Toolbar from '../components/core/Toolbar';
import MessageBar from '../components/core/MessageBar';
import PredictionBar from '../components/core/PredictionBar';

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#12121e', padding: 20 }}>
          <Text style={{ color: '#F44336', fontSize: 20, fontWeight: '700', marginBottom: 12 }}>Something went wrong</Text>
          <Text style={{ color: '#aaa', fontSize: 14, textAlign: 'center' }}>{this.state.error.message}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const { highContrastMode } = useSettingsStore();

  useEffect(() => {
    const init = async () => {
      try {
        const db = await getDatabase();
        await seedDatabase(db);
        await runStartupDecay();
      } catch (e: any) {
        console.error('PrismAAC init failed:', e);
        setInitError(e?.message ?? 'Unknown initialization error');
      }
      setReady(true);
    };
    init();
  }, []);

  if (!ready) return null;

  if (initError) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#12121e', padding: 20 }}>
        <Text style={{ color: '#F44336', fontSize: 20, fontWeight: '700', marginBottom: 12 }}>Failed to start</Text>
        <Text style={{ color: '#aaa', fontSize: 14, textAlign: 'center' }}>{initError}</Text>
      </View>
    );
  }

  const bgColor = highContrastMode ? '#000' : '#12121e';

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <SafeAreaView style={[styles.container, { backgroundColor: bgColor }]}>
            <StatusBar style="light" />
            <KeyboardAvoidingView
              style={styles.flex}
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              keyboardVerticalOffset={0}
            >
              <Toolbar />
              <MessageBar />
              <PredictionBar />
              <View style={styles.content}>
                <Slot />
              </View>
            </KeyboardAvoidingView>
          </SafeAreaView>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
});
