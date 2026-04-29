import React from 'react';
import { View, StyleSheet } from 'react-native';
import MathKeyboard from '../components/math/MathKeyboard';

export default function MathScreen() {
  return (
    <View style={styles.container}>
      <MathKeyboard />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
