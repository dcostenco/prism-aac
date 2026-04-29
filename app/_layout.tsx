import React, { useEffect, useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
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

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const { highContrastMode } = useSettingsStore();

  useEffect(() => {
    const init = async () => {
      const db = await getDatabase();
      await seedDatabase(db);
      await runStartupDecay();
      setReady(true);
    };
    init();
  }, []);

  if (!ready) return null;

  const bgColor = highContrastMode ? '#000' : '#12121e';

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <SafeAreaView style={[styles.container, { backgroundColor: bgColor }]}>
          <StatusBar style="light" />
          <KeyboardAvoidingView
            style={styles.flex}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={0}
          >
            {/* Persistent top: Toolbar */}
            <Toolbar />

            {/* Persistent: MessageBar */}
            <MessageBar />

            {/* Persistent: PredictionBar */}
            <PredictionBar />

            {/* Content area: swaps between keyboard, categories, math, settings */}
            <View style={styles.content}>
              <Slot />
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </SafeAreaProvider>
    </GestureHandlerRootView>
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
