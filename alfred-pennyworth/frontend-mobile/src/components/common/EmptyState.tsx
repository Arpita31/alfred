import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';

interface Props {
  icon?: string;
  message: string;
}

export function EmptyState({ icon = '📭', message }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  icon:      { fontSize: 32 },
  message:   { color: colors.subtext, fontSize: 14, textAlign: 'center' },
});
