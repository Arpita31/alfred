import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '../../theme/colors';

interface Props {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  style?: ViewStyle;
}

/**
 * Consistent screen-level header used by all 7 screens.
 * Saves 3-5 lines per screen × 7 screens.
 *
 * Usage:
 *   <ScreenHeader title="Sleep" subtitle="Track rest & recovery" />
 *   <ScreenHeader title="Alfred" right={<StatusDot online={apiOnline} />} />
 */
export function ScreenHeader({ title, subtitle, right, style }: Props) {
  return (
    <View style={[styles.header, style]}>
      <View style={styles.left}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.sub}>{subtitle}</Text> : null}
      </View>
      {right ?? null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { marginBottom: 16 },
  left:   { flex: 1 },
  title:  { fontSize: 26, fontWeight: '800', color: colors.text },
  sub:    { fontSize: 13, color: colors.muted, marginTop: 3 },
});
