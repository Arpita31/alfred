import { View, StyleSheet, ViewStyle } from 'react-native';
import { PrimaryButton } from './PrimaryButton';
import { GhostButton } from './GhostButton';
import { colors } from '../../theme/colors';

interface Action {
  label: string;
  onPress: () => void;
  color?: string;
  disabled?: boolean;
  ghost?: boolean;
}

interface Props {
  actions: Action[];
  style?: ViewStyle;
}

/**
 * A horizontal row of buttons (mix of primary/ghost).
 * Replaces 6+ repeated <View style={row}><PrimaryButton /><GhostButton /></View> patterns.
 *
 * Usage:
 *   <ButtonRow actions={[
 *     { label: 'Confirm', onPress: confirm, color: colors.green },
 *     { label: 'Cancel',  onPress: reset, ghost: true },
 *   ]} />
 */
export function ButtonRow({ actions, style }: Props) {
  return (
    <View style={[styles.row, style]}>
      {actions.map((a, i) =>
        a.ghost ? (
          <GhostButton key={i} label={a.label} onPress={a.onPress} color={a.color ?? colors.blue} style={styles.flex} />
        ) : (
          <PrimaryButton key={i} label={a.label} onPress={a.onPress} color={a.color} disabled={a.disabled} style={styles.flex} />
        ),
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row:  { flexDirection: 'row', gap: 10 },
  flex: { flex: 1 },
});
