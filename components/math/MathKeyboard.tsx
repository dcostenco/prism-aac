import React, { useCallback } from 'react';
import { View, Pressable, Text, StyleSheet, FlatList } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { useMessageStore } from '../../store/messageStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useSubscriptionStore } from '../../store/subscriptionStore';
import { MATH_ITEMS, MathItem } from '../../constants/mathSymbols';

export default function MathKeyboard() {
  const { t } = useTranslation();
  const { appendText } = useMessageStore();
  const { hapticEnabled, highContrastMode } = useSettingsStore();
  const { limits } = useSubscriptionStore();

  const items = limits.hasMathFull
    ? MATH_ITEMS
    : MATH_ITEMS.filter(m => m.category === 'basic');

  const handlePress = useCallback((item: MathItem) => {
    if (hapticEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    appendText(item.symbol);
  }, [appendText, hapticEnabled]);

  const isHC = highContrastMode;
  const basicItems = items.filter(i => i.category === 'basic');
  const advancedItems = items.filter(i => i.category === 'advanced');

  const renderItem = ({ item }: { item: MathItem }) => (
    <Pressable
      style={[styles.key, isHC && styles.keyHC]}
      onPress={() => handlePress(item)}
      accessibilityLabel={item.ttsText}
      accessibilityRole="button"
    >
      <Text style={[styles.symbol, isHC && styles.symbolHC]}>{item.symbol}</Text>
      <Text style={[styles.label, isHC && styles.labelHC]}>{item.label}</Text>
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <Text style={[styles.sectionTitle, isHC && styles.sectionTitleHC]}>{t('basic')}</Text>
      <FlatList
        data={basicItems}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        numColumns={5}
        scrollEnabled={false}
      />
      {advancedItems.length > 0 && (
        <>
          <Text style={[styles.sectionTitle, isHC && styles.sectionTitleHC]}>{t('advanced_math')}</Text>
          <FlatList
            data={advancedItems}
            renderItem={renderItem}
            keyExtractor={item => item.id}
            numColumns={5}
            scrollEnabled={false}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#999',
    marginVertical: 8,
    marginLeft: 4,
  },
  sectionTitleHC: {
    color: '#fff',
  },
  key: {
    flex: 1,
    minHeight: 64,
    minWidth: 64,
    backgroundColor: '#2a2a3e',
    borderRadius: 12,
    margin: 4,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
  },
  keyHC: {
    backgroundColor: '#000',
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  symbol: {
    fontSize: 24,
    color: '#f0f0f0',
    fontWeight: '600',
  },
  symbolHC: {
    color: '#FFD700',
    fontSize: 28,
  },
  label: {
    fontSize: 10,
    color: '#888',
    marginTop: 2,
  },
  labelHC: {
    color: '#ccc',
  },
});
