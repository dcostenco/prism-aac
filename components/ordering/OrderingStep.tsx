import React, { useCallback } from 'react';
import { View, Pressable, Text, StyleSheet, FlatList } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useMessageStore } from '../../store/messageStore';
import { useSettingsStore } from '../../store/settingsStore';
import { OrderingOption } from '../../types';

interface Props {
  label: string;
  options: OrderingOption[];
  onOptionSelect?: (option: OrderingOption) => void;
}

export default function OrderingStepView({ label, options, onOptionSelect }: Props) {
  const { appendText } = useMessageStore();
  const { hapticEnabled, highContrastMode } = useSettingsStore();

  const handlePress = useCallback((option: OrderingOption) => {
    if (hapticEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    appendText(option.text);
    onOptionSelect?.(option);
  }, [appendText, hapticEnabled, onOptionSelect]);

  const isHC = highContrastMode;

  return (
    <View style={styles.container}>
      <Text style={[styles.stepLabel, isHC && styles.stepLabelHC]}>{label}</Text>
      <FlatList
        data={options}
        keyExtractor={(item) => item.id}
        numColumns={2}
        renderItem={({ item }) => (
          <Pressable
            style={[styles.option, isHC && styles.optionHC]}
            onPress={() => handlePress(item)}
            accessibilityLabel={item.text}
            accessibilityRole="button"
          >
            <Text style={[styles.optionText, isHC && styles.optionTextHC]}>
              {item.text}
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 12,
  },
  stepLabel: {
    fontSize: 20,
    fontWeight: '600',
    color: '#b0b0c0',
    marginBottom: 12,
    textAlign: 'center',
  },
  stepLabelHC: {
    color: '#FFD700',
    fontSize: 22,
  },
  option: {
    flex: 1,
    backgroundColor: '#2a2a3e',
    borderRadius: 16,
    padding: 16,
    margin: 6,
    minHeight: 64,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionHC: {
    backgroundColor: '#000',
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  optionText: {
    fontSize: 18,
    color: '#e0e0e0',
    textAlign: 'center',
    fontWeight: '500',
  },
  optionTextHC: {
    color: '#FFD700',
    fontSize: 20,
    fontWeight: '700',
  },
});
