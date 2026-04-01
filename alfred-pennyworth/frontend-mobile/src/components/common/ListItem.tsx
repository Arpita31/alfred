import { ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '../../theme/colors';

interface Props {
  primary: string;
  secondary?: ReactNode;
  value?: string;
  valueColor?: string;
  badge?: string;
  badgeColor?: string;
  onDelete?: () => void;
  style?: ViewStyle;
}

/**
 * A single list row with primary text, optional secondary/badge metadata, colored value, and delete button.
 * Replaces the repeated 8-line "row + label + value + × button" pattern.
 *
 * Usage:
 *   <ListItem
 *     primary="AAPL Brokerage"
 *     value="$12,000"
 *     valueColor={colors.green}
 *     badge="Growth"
 *     onDelete={() => removeAsset(id)}
 *   />
 */
export function ListItem({ primary, secondary, value, valueColor, badge, badgeColor, onDelete, style }: Props) {
  return (
    <View style={[styles.row, style]}>
      <View style={styles.left}>
        <Text style={styles.primary}>{primary}</Text>
        {typeof secondary === 'string'
          ? <Text style={styles.secondary}>{secondary}</Text>
          : secondary ?? null}
      </View>
      <View style={styles.right}>
        {badge ? (
          <View style={[styles.badge, { backgroundColor: badgeColor ?? colors.surface3 }]}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        ) : null}
        {value ? <Text style={[styles.value, { color: valueColor ?? colors.text }]}>{value}</Text> : null}
        {onDelete ? (
          <TouchableOpacity onPress={onDelete} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
            <Text style={styles.del}>×</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row:       { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.border },
  left:      { flex: 1 },
  primary:   { color: colors.text, fontSize: 13, fontWeight: '500' },
  secondary: { color: colors.muted, fontSize: 11, marginTop: 2 },
  right:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge:     { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  value:     { fontSize: 13, fontWeight: '600' },
  del:       { color: colors.red, fontSize: 18, lineHeight: 18 },
});
