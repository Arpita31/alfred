import { TextInput, TextInputProps, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';

interface Props extends TextInputProps {
  multiline?: boolean;
}

/**
 * Pre-styled TextInput matching the app theme.
 * Accepts all standard TextInput props — just omit the style boilerplate.
 */
export function StyledInput({ style, multiline, ...props }: Props) {
  return (
    <TextInput
      style={[styles.input, multiline && styles.multiline, style]}
      placeholderTextColor={colors.muted}
      multiline={multiline}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  input:     { backgroundColor: colors.bg, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, color: colors.text, borderWidth: 1, borderColor: colors.border, marginBottom: 8, fontSize: 14 },
  multiline: { minHeight: 60, textAlignVertical: 'top' },
});
