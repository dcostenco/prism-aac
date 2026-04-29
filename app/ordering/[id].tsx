import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import OrderingStepView from '../../components/ordering/OrderingStep';
import { getOrderingSteps, getOrderingOptions } from '../../db/repository';
import { useSettingsStore } from '../../store/settingsStore';
import { OrderingStep, OrderingOption } from '../../types';

interface StepWithOptions extends OrderingStep {
  options: OrderingOption[];
}

export default function OrderingFlowScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const { highContrastMode } = useSettingsStore();
  const [steps, setSteps] = useState<StepWithOptions[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      const rawSteps = await getOrderingSteps(id);
      const stepsWithOptions: StepWithOptions[] = [];
      for (const step of rawSteps) {
        const options = await getOrderingOptions(step.id);
        stepsWithOptions.push({ ...step, options });
      }
      setSteps(stepsWithOptions);
    };
    load();
  }, [id]);

  const currentStep = steps[currentStepIndex];
  const isFirst = currentStepIndex === 0;
  const isLast = currentStepIndex === steps.length - 1;
  const isHC = highContrastMode;

  if (!currentStep) return null;

  return (
    <View style={styles.container}>
      {/* Progress indicator */}
      <View style={styles.progressRow}>
        {steps.map((_, i) => (
          <View
            key={i}
            style={[
              styles.progressDot,
              i === currentStepIndex && styles.progressDotActive,
              i < currentStepIndex && styles.progressDotDone,
            ]}
          />
        ))}
      </View>

      {/* Current step content */}
      <OrderingStepView
        label={currentStep.label}
        options={currentStep.options}
      />

      {/* Navigation */}
      <View style={styles.navRow}>
        {!isFirst && (
          <Pressable
            style={[styles.navButton, isHC && styles.navButtonHC]}
            onPress={() => setCurrentStepIndex(i => i - 1)}
            accessibilityLabel={t('previous_step')}
          >
            <Text style={[styles.navText, isHC && styles.navTextHC]}>← {t('previous_step')}</Text>
          </Pressable>
        )}
        <View style={styles.spacer} />
        {!isLast ? (
          <Pressable
            style={[styles.navButton, styles.navButtonPrimary, isHC && styles.navButtonHC]}
            onPress={() => setCurrentStepIndex(i => i + 1)}
            accessibilityLabel={t('next_step')}
          >
            <Text style={[styles.navText, isHC && styles.navTextHC]}>{t('next_step')} →</Text>
          </Pressable>
        ) : (
          <Pressable
            style={[styles.navButton, styles.navButtonDone, isHC && styles.navButtonHC]}
            onPress={() => router.back()}
            accessibilityLabel={t('finish_order')}
          >
            <Text style={[styles.navText, isHC && styles.navTextHC]}>✓ {t('finish_order')}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 8,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginVertical: 12,
  },
  progressDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#333',
  },
  progressDotActive: {
    backgroundColor: '#4CAF50',
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  progressDotDone: {
    backgroundColor: '#2E7D32',
  },
  navRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  spacer: {
    flex: 1,
  },
  navButton: {
    backgroundColor: '#2a2a3e',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    minHeight: 56,
    justifyContent: 'center',
  },
  navButtonPrimary: {
    backgroundColor: '#1976D2',
  },
  navButtonDone: {
    backgroundColor: '#4CAF50',
  },
  navButtonHC: {
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  navText: {
    fontSize: 18,
    color: '#fff',
    fontWeight: '600',
  },
  navTextHC: {
    color: '#FFD700',
  },
});
