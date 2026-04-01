import { ScrollView, View, Text, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useActivity } from '../hooks/useActivity';
import { TrainingLoadCard } from '../components/activity/TrainingLoadCard';
import { ChipSelector } from '../components/common/ChipSelector';
import { PrimaryButton } from '../components/common/PrimaryButton';
import { Card } from '../components/common/Card';
import { DataCard } from '../components/common/DataCard';
import { ScreenHeader } from '../components/common/ScreenHeader';
import { SectionLabel } from '../components/common/SectionLabel';
import { ListItem } from '../components/common/ListItem';
import { StyledInput } from '../components/common/StyledInput';
import { colors } from '../theme/colors';
import { ACTIVITY_TYPE_CHIPS, ACTIVITY_PRESETS } from '../constants/options';
import { ActivityRecord } from '../types/health';

export function ActivityScreen() {
  const {
    history, smartInput, activityType, duration,
    setSmartInput, setActivityType, setDuration,
    parseInput, save,
    trainingLoad, streak, recovery, tips, weekOverWeek, baseline, nextSuggestion, icon,
  } = useActivity();

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScreenHeader title="Activity" subtitle="Train smart with AI-guided recovery." />

        <TrainingLoadCard load={trainingLoad} recovery={recovery} streak={streak} />

        {tips.length > 0 && (
          <Card>
            <SectionLabel label="coaching" />
            {tips.map((tip, i) => <Text key={i} style={styles.tip}>• {tip}</Text>)}
          </Card>
        )}

        <Card>
          <SectionLabel label="next workout" />
          <Text style={styles.suggestion}>{nextSuggestion}</Text>
        </Card>

        {weekOverWeek.lastWeek > 0 && (
          <Card>
            <SectionLabel label="week over week" />
            <Text style={[styles.wow, { color: weekOverWeek.dir === 'up' ? colors.green : weekOverWeek.dir === 'down' ? colors.red : colors.subtext }]}>
              {weekOverWeek.dir === 'up' ? '↑' : weekOverWeek.dir === 'down' ? '↓' : '→'} {Math.abs(weekOverWeek.pct)}% vs last week
            </Text>
          </Card>
        )}

        <Card>
          <SectionLabel label="log activity" />
          <StyledInput
            placeholder='e.g. "ran 5km" or "gym 45min"'
            value={smartInput}
            onChangeText={setSmartInput}
            onSubmitEditing={parseInput}
            returnKeyType="done"
          />

          <SectionLabel label="type" />
          <ChipSelector options={ACTIVITY_TYPE_CHIPS} selected={activityType} onSelect={setActivityType} />

          <SectionLabel label="presets" />
          <View style={styles.presetRow}>
            {ACTIVITY_PRESETS.map((p: { label: string; type: string; duration: number }) => (
              <PrimaryButton
                key={p.label}
                label={p.label}
                onPress={() => { setActivityType(p.type); setDuration(p.duration); }}
                color={activityType === p.type && duration === p.duration ? colors.blue : colors.surface2}
                style={styles.flex}
              />
            ))}
          </View>

          <SectionLabel label={`duration: ${duration} min`} />
          <View style={styles.durationRow}>
            {[15, 30, 45, 60, 90].map(d => (
              <PrimaryButton key={d} label={`${d}m`} onPress={() => setDuration(d)}
                color={duration === d ? colors.orange : colors.surface2} style={styles.flex} />
            ))}
          </View>

          {baseline !== null && <Text style={styles.baseline}>Your avg {activityType}: {baseline} min</Text>}

          <PrimaryButton label={`${icon} Log ${duration}min ${activityType}`} onPress={save} color={colors.orange} style={styles.saveBtn} />
        </Card>

        <DataCard label="recent" isEmpty={history.length === 0} emptyIcon="⚡" emptyMessage="Log your first workout to see insights here.">
          {history.slice(0, 5).map((r: ActivityRecord, i: number) => (
            <ListItem
              key={i}
              primary={r.type}
              secondary={`${r.duration}min · ${r.calories} kcal`}
              value={r.date}
              valueColor={colors.muted}
            />
          ))}
        </DataCard>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen:      { flex: 1, backgroundColor: colors.bg },
  content:     { padding: 16, paddingBottom: 40 },
  tip:         { color: colors.subtext, fontSize: 13, lineHeight: 20, marginBottom: 4 },
  suggestion:  { color: colors.text, fontSize: 14, lineHeight: 20 },
  wow:         { fontSize: 20, fontWeight: '700' },
  presetRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  durationRow: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  flex:        { flex: 1 },
  baseline:    { color: colors.subtext, fontSize: 12, marginBottom: 10, fontStyle: 'italic' },
  saveBtn:     { marginTop: 4 },
});
