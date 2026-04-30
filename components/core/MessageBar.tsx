import React, { useRef, useCallback } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, I18nManager } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { useMessageStore } from '../../store/messageStore';
import { useSettingsStore } from '../../store/settingsStore';
import { speak, stop } from '../../services/speech/speechService';

export default function MessageBar() {
  const { t } = useTranslation();
  const { text, deleteLastWord, clearAll, setText } = useMessageStore();
  const settings = useSettingsStore();
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSpeak = useCallback(async () => {
    if (!text.trim()) return;
    try {
      if (settings.hapticEnabled) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      await speak(text, {
        rate: settings.speechRate,
        pitch: settings.speechPitch,
        volume: settings.speechVolume,
        tone: settings.defaultTone,
        language: settings.language,
        voiceId: settings.voiceId,
      });
    } catch {
      // Gracefully handle TTS/haptic failures
    }
  }, [text, settings]);

  const handleDeletePressIn = useCallback(() => {
    deleteTimerRef.current = setTimeout(() => {
      clearAll();
      if (settings.hapticEnabled) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
      deleteTimerRef.current = null;
    }, 500);
  }, [clearAll, settings.hapticEnabled]);

  const handleDeletePressOut = useCallback(() => {
    if (deleteTimerRef.current !== null) {
      clearTimeout(deleteTimerRef.current);
      deleteTimerRef.current = null;
      deleteLastWord();
      if (settings.hapticEnabled) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    }
  }, [deleteLastWord, settings.hapticEnabled]);

  const isHighContrast = settings.highContrastMode;

  return (
    <View style={[styles.container, isHighContrast && styles.containerHC]}>
      <TextInput
        style={[styles.textInput, isHighContrast && styles.textInputHC]}
        value={text}
        onChangeText={setText}
        placeholder={t('type_here')}
        placeholderTextColor={isHighContrast ? '#999' : '#888'}
        multiline
        textAlign={I18nManager.isRTL ? 'right' : 'left'}
        accessibilityLabel={t('type_here')}
      />
      <View style={styles.buttons}>
        <Pressable
          style={[styles.button, styles.speakButton, isHighContrast && styles.buttonHC]}
          onPress={handleSpeak}
          accessibilityLabel={t('speak')}
          accessibilityRole="button"
        >
          <Text style={styles.buttonIcon}>▶</Text>
        </Pressable>
        <Pressable
          style={[styles.button, styles.deleteButton, isHighContrast && styles.buttonHC]}
          onPressIn={handleDeletePressIn}
          onPressOut={handleDeletePressOut}
          accessibilityLabel={t('delete')}
          accessibilityHint="Tap to delete last word, hold to clear all"
          accessibilityRole="button"
        >
          <Text style={styles.buttonIcon}>⌫</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e1e2e',
    borderRadius: 16,
    marginHorizontal: 12,
    marginVertical: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 64,
  },
  containerHC: {
    backgroundColor: '#000',
    borderWidth: 2,
    borderColor: '#fff',
  },
  textInput: {
    flex: 1,
    fontSize: 24,
    color: '#f0f0f0',
    minHeight: 48,
    paddingVertical: 4,
  },
  textInputHC: {
    color: '#fff',
    fontSize: 28,
  },
  buttons: {
    flexDirection: 'row',
    gap: 8,
    marginLeft: 8,
  },
  button: {
    width: 64,
    height: 64,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonHC: {
    borderWidth: 2,
    borderColor: '#fff',
  },
  speakButton: {
    backgroundColor: '#4CAF50',
  },
  deleteButton: {
    backgroundColor: '#F44336',
  },
  buttonIcon: {
    fontSize: 24,
    color: '#fff',
  },
});
