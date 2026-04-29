import React, { useEffect, useState } from 'react';
import { View, Text, Switch, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Slider from '@react-native-community/slider';
import { useSettingsStore } from '../store/settingsStore';
import { useSubscriptionStore } from '../store/subscriptionStore';
import { SUPPORTED_LANGUAGES, SupportedLanguage } from '../types';
import i18n from '../i18n';

export default function SettingsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const settings = useSettingsStore();
  const { tier } = useSubscriptionStore();
  const isHC = settings.highContrastMode;

  const handleLanguageChange = (code: SupportedLanguage) => {
    settings.update({ language: code });
    i18n.changeLanguage(code);
  };

  return (
    <ScrollView style={[styles.container, isHC && styles.containerHC]}>
      {/* Voice Settings */}
      <Text style={[styles.section, isHC && styles.sectionHC]}>{t('voice')}</Text>

      <View style={styles.row}>
        <Text style={[styles.label, isHC && styles.labelHC]}>{t('speed')}</Text>
        <Text style={[styles.value, isHC && styles.valueHC]}>{settings.speechRate.toFixed(1)}</Text>
      </View>
      <View style={styles.sliderRow}>
        <Text style={styles.sliderLabel}>0.1</Text>
        <View style={styles.sliderContainer}>
          <Slider
            minimumValue={0.1}
            maximumValue={1.0}
            step={0.1}
            value={settings.speechRate}
            onValueChange={(v: number) => settings.update({ speechRate: v })}
            minimumTrackTintColor="#4CAF50"
            maximumTrackTintColor="#444"
            thumbTintColor="#4CAF50"
          />
        </View>
        <Text style={styles.sliderLabel}>1.0</Text>
      </View>

      <View style={styles.row}>
        <Text style={[styles.label, isHC && styles.labelHC]}>{t('volume')}</Text>
        <Text style={[styles.value, isHC && styles.valueHC]}>{Math.round(settings.speechVolume * 100)}%</Text>
      </View>
      <View style={styles.sliderRow}>
        <Text style={styles.sliderLabel}>0</Text>
        <View style={styles.sliderContainer}>
          <Slider
            minimumValue={0}
            maximumValue={1.0}
            step={0.1}
            value={settings.speechVolume}
            onValueChange={(v: number) => settings.update({ speechVolume: v })}
            minimumTrackTintColor="#2196F3"
            maximumTrackTintColor="#444"
            thumbTintColor="#2196F3"
          />
        </View>
        <Text style={styles.sliderLabel}>100</Text>
      </View>

      {/* Language */}
      <Text style={[styles.section, isHC && styles.sectionHC]}>{t('language')}</Text>
      <View style={styles.languageGrid}>
        {SUPPORTED_LANGUAGES.map((lang) => (
          <Pressable
            key={lang.code}
            style={[
              styles.langButton,
              settings.language === lang.code && styles.langButtonActive,
              isHC && styles.langButtonHC,
            ]}
            onPress={() => handleLanguageChange(lang.code)}
            accessibilityLabel={lang.name}
          >
            <Text style={[styles.langText, isHC && styles.langTextHC]}>{lang.nativeName}</Text>
          </Pressable>
        ))}
      </View>

      {/* Accessibility */}
      <Text style={[styles.section, isHC && styles.sectionHC]}>{t('accessibility')}</Text>

      <View style={styles.row}>
        <Text style={[styles.label, isHC && styles.labelHC]}>{t('high_contrast')}</Text>
        <Switch
          value={settings.highContrastMode}
          onValueChange={(v) => settings.update({ highContrastMode: v })}
          trackColor={{ false: '#444', true: '#4CAF50' }}
        />
      </View>

      <View style={styles.row}>
        <Text style={[styles.label, isHC && styles.labelHC]}>{t('haptic_feedback')}</Text>
        <Switch
          value={settings.hapticEnabled}
          onValueChange={(v) => settings.update({ hapticEnabled: v })}
          trackColor={{ false: '#444', true: '#4CAF50' }}
        />
      </View>

      <View style={styles.row}>
        <Text style={[styles.label, isHC && styles.labelHC]}>{t('audio_feedback')}</Text>
        <Switch
          value={settings.audioFeedbackEnabled}
          onValueChange={(v) => settings.update({ audioFeedbackEnabled: v })}
          trackColor={{ false: '#444', true: '#4CAF50' }}
        />
      </View>

      {/* Subscription */}
      <Text style={[styles.section, isHC && styles.sectionHC]}>{t('subscription')}</Text>
      <View style={styles.tierRow}>
        <Text style={[styles.tierLabel, isHC && styles.tierLabelHC]}>
          {t(tier)}
        </Text>
        {tier === 'free' && (
          <Pressable style={[styles.upgradeButton, isHC && styles.upgradeButtonHC]}>
            <Text style={styles.upgradeText}>{t('upgrade')}</Text>
          </Pressable>
        )}
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  containerHC: {
    backgroundColor: '#000',
  },
  section: {
    fontSize: 18,
    fontWeight: '700',
    color: '#888',
    marginTop: 20,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  sectionHC: {
    color: '#FFD700',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  label: {
    fontSize: 17,
    color: '#d0d0e0',
  },
  labelHC: {
    color: '#fff',
    fontSize: 19,
  },
  value: {
    fontSize: 17,
    color: '#aaa',
  },
  valueHC: {
    color: '#FFD700',
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 8,
  },
  sliderContainer: {
    flex: 1,
    height: 40,
    justifyContent: 'center',
  },
  sliderLabel: {
    fontSize: 12,
    color: '#666',
    width: 24,
    textAlign: 'center',
  },
  languageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  langButton: {
    backgroundColor: '#2a2a3e',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minWidth: 80,
    alignItems: 'center',
  },
  langButtonActive: {
    backgroundColor: '#4CAF50',
  },
  langButtonHC: {
    borderWidth: 2,
    borderColor: '#666',
  },
  langText: {
    fontSize: 15,
    color: '#e0e0e0',
  },
  langTextHC: {
    color: '#fff',
    fontWeight: '600',
  },
  tierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  tierLabel: {
    fontSize: 20,
    color: '#e0e0e0',
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  tierLabelHC: {
    color: '#FFD700',
  },
  upgradeButton: {
    backgroundColor: '#1976D2',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  upgradeButtonHC: {
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  upgradeText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
