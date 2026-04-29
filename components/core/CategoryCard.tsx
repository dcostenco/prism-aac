import React, { useCallback } from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useSettingsStore } from '../../store/settingsStore';
import { Category } from '../../types';

interface Props {
  category: Category;
}

export default function CategoryCard({ category }: Props) {
  const router = useRouter();
  const { hapticEnabled, highContrastMode } = useSettingsStore();

  const handlePress = useCallback(() => {
    if (hapticEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.push(`/categories/${category.id}`);
  }, [category.id, hapticEnabled, router]);

  const isHC = highContrastMode;

  return (
    <Pressable
      style={[styles.card, isHC && styles.cardHC]}
      onPress={handlePress}
      accessibilityLabel={category.name}
      accessibilityRole="button"
    >
      <Text style={styles.icon}>{category.icon}</Text>
      <Text style={[styles.label, isHC && styles.labelHC]}>{category.name}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#2a2a3e',
    borderRadius: 20,
    padding: 16,
    minHeight: 120,
    minWidth: 140,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 8,
    flex: 1,
  },
  cardHC: {
    backgroundColor: '#000',
    borderWidth: 3,
    borderColor: '#FFD700',
  },
  icon: {
    fontSize: 40,
    marginBottom: 8,
  },
  label: {
    fontSize: 18,
    color: '#e0e0e0',
    textAlign: 'center',
    fontWeight: '600',
  },
  labelHC: {
    color: '#FFD700',
    fontSize: 20,
    fontWeight: '700',
  },
});
