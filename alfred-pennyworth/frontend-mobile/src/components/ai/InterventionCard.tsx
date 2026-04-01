import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Intervention, FeedbackResponse } from '../../types/intervention';
import { Card } from '../common/Card';
import { PrimaryButton } from '../common/PrimaryButton';
import { GhostButton } from '../common/GhostButton';
import { colors } from '../../theme/colors';

interface Props {
  intervention: Intervention;
  onRespond: (r: FeedbackResponse) => void;
}

export function InterventionCard({ intervention, onRespond }: Props) {
  return (
    <Card style={styles.card}>
      <Text style={styles.title}>{intervention.title}</Text>
      <Text style={styles.message}>{intervention.message}</Text>
      <View style={styles.row}>
        <PrimaryButton label="Accept" onPress={() => onRespond('accepted')} color={colors.green} style={styles.btn} />
        <GhostButton  label="Snooze" onPress={() => onRespond('snoozed')}  color={colors.subtext} style={styles.btn} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card:    { borderLeftWidth: 3, borderLeftColor: colors.purple },
  title:   { color: colors.text, fontWeight: '700', fontSize: 15, marginBottom: 6 },
  message: { color: colors.subtext, fontSize: 14, lineHeight: 20, marginBottom: 14 },
  row:     { flexDirection: 'row', gap: 10 },
  btn:     { flex: 1 },
});
