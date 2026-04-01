import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';

export interface InfoChip {
  label: string;
  value: string;
  color?: string;
}

interface Props {
  chips: InfoChip[];
}

/**
 * A row of labeled metric chips.
 * Replaces the repeated pattern of 3-column chip rows across Hydration, Finance, etc.
 *
 * Usage:
 *   <InfoChipRow chips={[
 *     { label: 'GOAL', value: '2.5 L', color: colors.blue },
 *     { label: 'EOD EST.', value: '3.1 L', color: colors.green },
 *   ]} />
 */
export function InfoChipRow({ chips }: Props) {
  return (
    <View style={styles.row}>
      {chips.map((chip, i) => (
        <View key={i} style={styles.chip}>
          <Text style={styles.label}>{chip.label}</Text>
          <Text style={[styles.value, { color: chip.color ?? colors.text }]}>{chip.value}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row:   { flexDirection: 'row', gap: 8 },
  chip:  { flex: 1, backgroundColor: colors.surface3, borderRadius: 8, padding: 10, alignItems: 'center' },
  label: { fontSize: 10, color: colors.muted, marginBottom: 4, fontWeight: '700', letterSpacing: 0.5 },
  value: { fontSize: 15, fontWeight: '700' },
});
