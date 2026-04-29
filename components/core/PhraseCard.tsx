import React, { useCallback } from 'react';
import { Pressable, Text, StyleSheet, Image, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useMessageStore } from '../../store/messageStore';
import { useSettingsStore } from '../../store/settingsStore';
import { incrementPhraseUsage } from '../../db/repository';
import { learnFromInput } from '../../engine/predictionEngine';
import { Phrase, ToneStyle } from '../../types';

interface Props {
  phrase: Phrase;
}

export default function PhraseCard({ phrase }: Props) {
  const { appendText, setTone } = useMessageStore();
  const { hapticEnabled, highContrastMode } = useSettingsStore();

  const handlePress = useCallback(async () => {
    if (hapticEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    appendText(phrase.text);
    if (phrase.tone) setTone(phrase.tone as ToneStyle);
    await incrementPhraseUsage(phrase.id);
    await learnFromInput(phrase.text);
  }, [phrase, appendText, setTone, hapticEnabled]);

  const isHC = highContrastMode;
  const displayLabel = phrase.displayText || phrase.text;

  return (
    <Pressable
      style={[styles.card, isHC && styles.cardHC]}
      onPress={handlePress}
      accessibilityLabel={phrase.text}
      accessibilityRole="button"
    >
      {phrase.imageUri && (
        <Image
          source={{ uri: phrase.imageUri }}
          style={styles.image}
          accessibilityIgnoresInvertColors
        />
      )}
      <Text
        style={[styles.label, isHC && styles.labelHC]}
        numberOfLines={2}
      >
        {displayLabel}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#2a2a3e',
    borderRadius: 16,
    padding: 12,
    minHeight: 80,
    minWidth: 100,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 6,
    flex: 1,
  },
  cardHC: {
    backgroundColor: '#000',
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  image: {
    width: 48,
    height: 48,
    borderRadius: 8,
    marginBottom: 6,
  },
  label: {
    fontSize: 16,
    color: '#e0e0e0',
    textAlign: 'center',
    fontWeight: '500',
  },
  labelHC: {
    color: '#FFD700',
    fontSize: 18,
    fontWeight: '700',
  },
});
