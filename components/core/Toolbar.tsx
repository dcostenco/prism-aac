import React, { useState } from 'react';
import { View, Pressable, Text, StyleSheet, Modal, FlatList } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useMessageStore } from '../../store/messageStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useSubscriptionStore } from '../../store/subscriptionStore';
import { TONES, ToneDefinition } from '../../constants/tones';
import { ToneStyle } from '../../types';

export default function Toolbar() {
  const { t } = useTranslation();
  const router = useRouter();
  const { activeTone, setTone } = useMessageStore();
  const { hapticEnabled, highContrastMode } = useSettingsStore();
  const { limits } = useSubscriptionStore();
  const [showTonePicker, setShowTonePicker] = useState(false);

  const availableTones = limits.hasTones
    ? TONES.slice(0, limits.toneCount || TONES.length)
    : [];
  const currentTone = TONES.find(t => t.id === activeTone);

  const handleTap = (action: () => void) => {
    if (hapticEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    action();
  };

  const handleToneSelect = (tone: ToneStyle) => {
    setTone(tone);
    setShowTonePicker(false);
  };

  const isHC = highContrastMode;

  return (
    <View style={[styles.container, isHC && styles.containerHC]}>
      <View style={styles.leftGroup}>
        {availableTones.length > 0 && (
          <Pressable
            style={[styles.button, isHC && styles.buttonHC]}
            onPress={() => handleTap(() => setShowTonePicker(true))}
            accessibilityLabel={t('tone')}
          >
            <Text style={styles.buttonText}>{currentTone?.icon ?? '😊'}</Text>
          </Pressable>
        )}
        <Pressable
          style={[styles.button, isHC && styles.buttonHC]}
          onPress={() => handleTap(() => router.push('/categories'))}
          accessibilityLabel={t('categories')}
        >
          <Text style={styles.buttonText}>📂</Text>
        </Pressable>
        <Pressable
          style={[styles.button, isHC && styles.buttonHC]}
          onPress={() => handleTap(() => router.push('/math'))}
          accessibilityLabel={t('math')}
        >
          <Text style={styles.buttonText}>🔢</Text>
        </Pressable>
      </View>

      <View style={styles.rightGroup}>
        <Pressable
          style={[styles.button, isHC && styles.buttonHC]}
          onPress={() => handleTap(() => router.push('/settings'))}
          accessibilityLabel={t('settings')}
        >
          <Text style={styles.buttonText}>⚙️</Text>
        </Pressable>
      </View>

      <Modal visible={showTonePicker} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setShowTonePicker(false)}>
          <View style={[styles.tonePicker, isHC && styles.tonePickerHC]}>
            <Text style={[styles.toneTitle, isHC && styles.toneTitleHC]}>{t('select_tone')}</Text>
            <FlatList
              data={availableTones}
              numColumns={3}
              keyExtractor={(item) => item.id}
              renderItem={({ item }: { item: ToneDefinition }) => (
                <Pressable
                  style={[
                    styles.toneItem,
                    item.id === activeTone && styles.toneItemActive,
                    isHC && styles.toneItemHC,
                  ]}
                  onPress={() => handleToneSelect(item.id)}
                >
                  <Text style={styles.toneIcon}>{item.icon}</Text>
                  <Text style={[styles.toneLabel, isHC && styles.toneLabelHC]}>{item.label}</Text>
                </Pressable>
              )}
            />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#16162a',
  },
  containerHC: {
    backgroundColor: '#000',
    borderBottomWidth: 2,
    borderBottomColor: '#fff',
  },
  leftGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  rightGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  button: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#2a2a3e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonHC: {
    borderWidth: 2,
    borderColor: '#fff',
    backgroundColor: '#111',
  },
  buttonText: {
    fontSize: 24,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tonePicker: {
    backgroundColor: '#1e1e2e',
    borderRadius: 20,
    padding: 20,
    width: '80%',
    maxWidth: 400,
  },
  tonePickerHC: {
    backgroundColor: '#000',
    borderWidth: 2,
    borderColor: '#fff',
  },
  toneTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#f0f0f0',
    textAlign: 'center',
    marginBottom: 16,
  },
  toneTitleHC: {
    color: '#FFD700',
  },
  toneItem: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    margin: 4,
    borderRadius: 12,
    backgroundColor: '#2a2a3e',
    minWidth: 90,
  },
  toneItemActive: {
    backgroundColor: '#4CAF50',
  },
  toneItemHC: {
    borderWidth: 1,
    borderColor: '#666',
  },
  toneIcon: {
    fontSize: 32,
    marginBottom: 4,
  },
  toneLabel: {
    fontSize: 12,
    color: '#ccc',
  },
  toneLabelHC: {
    color: '#fff',
    fontWeight: '600',
  },
});
