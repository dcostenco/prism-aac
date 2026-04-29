import React, { useEffect, useState } from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import CategoryCard from '../../components/core/CategoryCard';
import { getCategories } from '../../db/repository';
import { Category } from '../../types';

export default function CategoriesScreen() {
  const { t } = useTranslation();
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    const load = async () => {
      const cats = await getCategories(null);
      setCategories(cats);
    };
    load();
  }, []);

  return (
    <View style={styles.container}>
      <FlatList
        data={categories}
        renderItem={({ item }) => <CategoryCard category={item} />}
        keyExtractor={(item) => item.id}
        numColumns={2}
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
  grid: {
    paddingBottom: 20,
  },
});
