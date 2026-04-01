import { ScrollView, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';

interface Props {
  options: readonly string[];
  selected: string | string[];
  onSelect: (value: string) => void;
  multi?: boolean;
  activeColor?: string;
}

export function ChipSelector({ options, selected, onSelect, multi = false, activeColor = colors.blue }: Props) {
  const isActive = (opt: string) =>
    multi ? (selected as string[]).includes(opt) : selected === opt;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {options.map(opt => (
        <TouchableOpacity
          key={opt}
          style={[styles.chip, isActive(opt) && { backgroundColor: activeColor, borderColor: activeColor }]}
          onPress={() => onSelect(opt)}
        >
          <Text style={[styles.label, isActive(opt) && styles.activeLabel]}>{opt}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row:         { flexDirection: 'row', gap: 8, paddingVertical: 4 },
  chip:        { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1, borderColor: colors.border },
  label:       { color: colors.subtext, fontSize: 13 },
  activeLabel: { color: colors.text, fontWeight: '600' },
});
