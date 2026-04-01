import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '../../theme/colors';

export interface StatDef {
  label: string;
  value: string;
  color?: string;
  sub?: string;
}

interface Props {
  stats: StatDef[];
  style?: ViewStyle;
}

/**
 * A horizontal row of labeled stats — generalizes the repeated 3-up metric pattern.
 * Used inside Cards like TrainingLoadCard, Finance metrics row, etc.
 *
 * Usage:
 *   <StatRow stats={[
 *     { label: 'Load',     value: '420',  color: colors.orange },
 *     { label: 'Streak',   value: '5d 🔥', color: colors.yellow },
 *     { label: 'Recovery', value: '72',   color: colors.green },
 *   ]} />
 */
export function StatRow({ stats, style }: Props) {
  return (
    <View style={[styles.row, style]}>
      {stats.map((s, i) => (
        <View key={i} style={styles.stat}>
          <Text style={styles.label}>{s.label}</Text>
          <Text style={[styles.value, { color: s.color ?? colors.text }]}>{s.value}</Text>
          {s.sub ? <Text style={styles.sub}>{s.sub}</Text> : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row:   { flexDirection: 'row', justifyContent: 'space-between' },
  stat:  { alignItems: 'center', flex: 1 },
  label: { color: colors.muted, fontSize: 11, fontWeight: '600', marginBottom: 4 },
  value: { fontSize: 22, fontWeight: '800' },
  sub:   { color: colors.muted, fontSize: 11, marginTop: 2 },
});
