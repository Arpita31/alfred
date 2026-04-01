import { ScrollView, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { Text } from 'react-native';
import { useNutrition } from '../hooks/useNutrition';
import { MacroGrid } from '../components/nutrition/MacroGrid';
import { ChipSelector } from '../components/common/ChipSelector';
import { PrimaryButton } from '../components/common/PrimaryButton';
import { ButtonRow } from '../components/common/ButtonRow';
import { Card } from '../components/common/Card';
import { ScreenHeader } from '../components/common/ScreenHeader';
import { SectionLabel } from '../components/common/SectionLabel';
import { ErrorState } from '../components/common/ErrorState';
import { StyledInput } from '../components/common/StyledInput';
import { colors } from '../theme/colors';
import { MEAL_TYPES } from '../constants/options';

export function NutritionScreen() {
  const { phase, preview, error, mealInput, mealType, setMealInput, setMealType, parse, confirm, reset } = useNutrition();

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScreenHeader title="Log a Meal" subtitle="Alfred learns your nutrition patterns." />

        <Card>
          <SectionLabel label="meal type" />
          <ChipSelector options={MEAL_TYPES} selected={mealType} onSelect={setMealType} />
          <SectionLabel label={phase === 'parsing' ? 'description — analysing…' : 'description'} />
          <StyledInput
            placeholder="e.g. 200g grilled salmon with rice"
            value={mealInput}
            onChangeText={setMealInput}
            multiline
          />
        </Card>

        {error ? <ErrorState message={error} /> : null}

        {preview && phase === 'preview' ? (
          <Card>
            <Text style={styles.dishName}>{preview.dish_matched ?? 'Custom meal'}</Text>
            <MacroGrid preview={preview} />
          </Card>
        ) : null}

        {phase === 'done' ? (
          <PrimaryButton label="✓ Saved! Log another" onPress={reset} color={colors.green} />
        ) : phase === 'preview' ? (
          <ButtonRow actions={[
            { label: 'Confirm', onPress: confirm, color: colors.green },
            { label: 'Back', onPress: reset, ghost: true },
          ]} />
        ) : (
          <PrimaryButton
            label={phase === 'parsing' ? 'Analysing…' : 'Analyse →'}
            onPress={parse}
            disabled={phase === 'parsing' || !mealInput.trim()}
          />
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen:   { flex: 1, backgroundColor: colors.bg },
  content:  { padding: 16, paddingBottom: 40 },
  dishName: { color: colors.text, fontWeight: '700', fontSize: 15, marginBottom: 4 },
});
