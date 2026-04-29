import React, { useEffect, useState, useCallback } from 'react';
import { View, Pressable, Text, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useMessageStore } from '../../store/messageStore';
import { useSettingsStore } from '../../store/settingsStore';
import { getPredictions, learnWord } from '../../engine/predictionEngine';
import { DEFAULT_PREDICTIONS } from '../../engine/predictionTypes';

export default function PredictionBar() {
  const { text, appendWord } = useMessageStore();
  const { hapticEnabled, highContrastMode } = useSettingsStore();
  const [predictions, setPredictions] = useState<string[]>(DEFAULT_PREDICTIONS);

  useEffect(() => {
    let cancelled = false;
    const update = async () => {
      const results = await getPredictions(text);
      if (!cancelled) setPredictions(results);
    };
    update();
    return () => { cancelled = true; };
  }, [text]);

  const handleTap = useCallback(async (word: string) => {
    if (hapticEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    const words = text.trim().split(/\s+/).filter(Boolean);
    const previousWord = words.length > 0 ? words[words.length - 1] : undefined;

    appendWord(word);
    await learnWord(word, previousWord);
  }, [text, appendWord, hapticEnabled]);

  return (
    <View style={[styles.container, highContrastMode && styles.containerHC]}>
      {predictions.map((word, index) => (
        <Pressable
          key={`${word}-${index}`}
          style={[styles.pill, highContrastMode && styles.pillHC]}
          onPress={() => handleTap(word)}
          accessibilityLabel={word}
          accessibilityRole="button"
        >
          <Text
            style={[styles.pillText, highContrastMode && styles.pillTextHC]}
            numberOfLines={1}
          >
            {word}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 8,
    justifyContent: 'center',
  },
  containerHC: {
    backgroundColor: '#111',
  },
  pill: {
    flex: 1,
    maxWidth: 160,
    minHeight: 48,
    backgroundColor: '#2a2a3e',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  pillHC: {
    backgroundColor: '#000',
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  pillText: {
    fontSize: 18,
    color: '#e0e0e0',
    fontWeight: '500',
    textAlign: 'center',
  },
  pillTextHC: {
    color: '#FFD700',
    fontSize: 20,
    fontWeight: '700',
  },
});
