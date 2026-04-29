import React, { useRef, useCallback, useEffect } from 'react';
import { View, TextInput, StyleSheet, I18nManager } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useMessageStore } from '../store/messageStore';
import { useSettingsStore } from '../store/settingsStore';
import { learnFromInput } from '../engine/predictionEngine';

export default function HomeScreen() {
  const { t } = useTranslation();
  const { text, setText } = useMessageStore();
  const { highContrastMode, language } = useSettingsStore();
  const inputRef = useRef<TextInput>(null);

  // Auto-focus the keyboard input
  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 300);
    return () => clearTimeout(timer);
  }, []);

  const handleChangeText = useCallback((newText: string) => {
    const oldWords = text.trim().split(/\s+/);
    const newWords = newText.trim().split(/\s+/);

    // If a word was just completed (space added), learn it
    if (newText.endsWith(' ') && newWords.length > oldWords.length) {
      const completedWord = newWords[newWords.length - 1];
      if (completedWord) {
        learnFromInput(completedWord);
      }
    }

    setText(newText);
  }, [text, setText]);

  const isHC = highContrastMode;

  return (
    <View style={styles.container}>
      <TextInput
        ref={inputRef}
        style={[styles.hiddenInput, isHC && styles.hiddenInputHC]}
        value={text}
        onChangeText={handleChangeText}
        placeholder={t('type_here')}
        placeholderTextColor={isHC ? '#666' : '#555'}
        multiline
        autoFocus
        textAlign={I18nManager.isRTL ? 'right' : 'left'}
        accessibilityLabel={t('type_here')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  hiddenInput: {
    // This TextInput drives the system keyboard but is visually minimal
    // The actual text display is in MessageBar
    fontSize: 1,
    color: 'transparent',
    height: 1,
    opacity: 0,
  },
  hiddenInputHC: {},
});
