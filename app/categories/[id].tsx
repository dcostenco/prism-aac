import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import PhraseCard from '../../components/core/PhraseCard';
import { getCategoryById, getPhrasesByCategory, getOrderingSequences } from '../../db/repository';
import { useSettingsStore } from '../../store/settingsStore';
import { Category, Phrase, OrderingSequence } from '../../types';

export default function CategoryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const { highContrastMode } = useSettingsStore();
  const [category, setCategory] = useState<Category | null>(null);
  const [phrases, setPhrases] = useState<Phrase[]>([]);
  const [sequences, setSequences] = useState<OrderingSequence[]>([]);

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      const cat = await getCategoryById(id);
      setCategory(cat);
      const phr = await getPhrasesByCategory(id);
      setPhrases(phr);
      const seqs = await getOrderingSequences(id);
      setSequences(seqs);
    };
    load();
  }, [id]);

  const isHC = highContrastMode;

  return (
    <View style={styles.container}>
      {category && (
        <Text style={[styles.title, isHC && styles.titleHC]}>
          {category.icon} {category.name}
        </Text>
      )}

      {/* Ordering sequences (e.g., Chipotle flow) */}
      {sequences.length > 0 && (
        <View style={styles.sequencesRow}>
          {sequences.map((seq) => (
            <Pressable
              key={seq.id}
              style={[styles.sequenceButton, isHC && styles.sequenceButtonHC]}
              onPress={() => router.push(`/ordering/${seq.id}`)}
              accessibilityLabel={`${t('ordering_flow')}: ${seq.name}`}
            >
              <Text style={[styles.sequenceText, isHC && styles.sequenceTextHC]}>
                🛒 {seq.name}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      <FlatList
        data={phrases}
        renderItem={({ item }) => <PhraseCard phrase={item} />}
        keyExtractor={(item) => item.id}
        numColumns={3}
        contentContainerStyle={styles.grid}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    color: '#d0d0e0',
    textAlign: 'center',
    marginVertical: 8,
  },
  titleHC: {
    color: '#FFD700',
    fontSize: 24,
  },
  sequencesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: 8,
    gap: 8,
  },
  sequenceButton: {
    backgroundColor: '#3a3a5e',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 48,
    justifyContent: 'center',
  },
  sequenceButtonHC: {
    backgroundColor: '#000',
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  sequenceText: {
    fontSize: 16,
    color: '#e0e0e0',
    fontWeight: '500',
  },
  sequenceTextHC: {
    color: '#FFD700',
    fontWeight: '700',
  },
  grid: {
    paddingBottom: 20,
  },
});
