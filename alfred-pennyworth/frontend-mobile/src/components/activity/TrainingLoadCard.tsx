import { Card } from '../common/Card';
import { StatRow } from '../common/StatRow';
import { ProgressBar } from '../common/ProgressBar';
import { Text, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';

interface Props {
  load: number;
  recovery: { label: string; score: number; color: string };
  streak: number;
}

export function TrainingLoadCard({ load, recovery, streak }: Props) {
  return (
    <Card>
      <StatRow stats={[
        { label: 'Training Load', value: `${load}`,     color: colors.orange },
        { label: 'Streak',        value: `${streak}d 🔥`, color: colors.yellow },
        { label: 'Recovery',      value: `${recovery.score}`, color: recovery.color },
      ]} style={styles.statsRow} />
      <Text style={[styles.recoveryLabel, { color: recovery.color }]}>{recovery.label}</Text>
      <ProgressBar pct={recovery.score} color={recovery.color} height={6} />
    </Card>
  );
}

const styles = StyleSheet.create({
  statsRow:      { marginBottom: 10 },
  recoveryLabel: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
});
