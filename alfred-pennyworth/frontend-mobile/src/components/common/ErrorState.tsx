import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';

interface Props { message: string }

export function ErrorState({ message }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>⚠️</Text>
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  icon:      { fontSize: 28 },
  message:   { color: colors.red, fontSize: 14, textAlign: 'center' },
});
