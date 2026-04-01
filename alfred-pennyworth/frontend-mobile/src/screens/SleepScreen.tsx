import { ScrollView, View, Text, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useSleep } from '../hooks/useSleep';
import { SleepScoreRing } from '../components/sleep/SleepScoreRing';
import { QualityPicker } from '../components/sleep/QualityPicker';
import { TimePicker } from '../components/sleep/TimePicker';
import { GhostButton } from '../components/common/GhostButton';
import { PrimaryButton } from '../components/common/PrimaryButton';
import { ButtonRow } from '../components/common/ButtonRow';
import { Card } from '../components/common/Card';
import { ScreenHeader } from '../components/common/ScreenHeader';
import { SectionLabel } from '../components/common/SectionLabel';
import { colors } from '../theme/colors';
import { SLEEP_TAGS, NAP_DURATIONS } from '../constants/options';
import { getDebtColor } from '../lib/ui/statusColor';

export function SleepScreen() {
  const {
    startTime, endTime, quality, selectedTags,
    setStartTime, setEndTime, setQuality, toggleTag,
    save, logNap,
    debt, chronotype, bedtimeRec, trend, tagImpact,
    predictedQuality, lastScore, lastHours,
  } = useSleep();

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScreenHeader title="Sleep" subtitle="Track rest so Alfred can optimise your recovery." />

        {/* Score + insight pills side by side */}
        <View style={styles.heroRow}>
          <SleepScoreRing score={lastScore} hours={lastHours} />
          <View style={styles.pills}>
            {debt > 0        && <Text style={[styles.pill, { color: getDebtColor(debt) }]}>{debt}h sleep debt</Text>}
            {chronotype      && <Text style={styles.pill}>{chronotype}</Text>}
            {trend.dir !== 'flat' && <Text style={[styles.pill, { color: trend.color }]}>{trend.desc}</Text>}
            <Text style={[styles.pill, { color: colors.muted }]}>Bed by {bedtimeRec}</Text>
          </View>
        </View>

        {/* Time inputs */}
        <Card>
          <View style={styles.timeRow}>
            <TimePicker label="🌙 fell asleep" value={startTime} onChange={setStartTime} />
            <TimePicker label="☀️ woke up"    value={endTime}   onChange={setEndTime} />
          </View>
        </Card>

        {/* Quality */}
        <Card>
          <View style={styles.qualHeader}>
            <SectionLabel label="sleep quality" />
            {predictedQuality !== null && (
              <Text style={{ color: predictedQuality >= 7 ? colors.green : predictedQuality >= 5 ? colors.accent : colors.red, fontSize: 12 }}>
                Predicted: {predictedQuality}/10
              </Text>
            )}
          </View>
          <QualityPicker value={quality} onChange={setQuality} />
        </Card>

        {/* Tags */}
        <Card>
          <SectionLabel label="factors" />
          <View style={styles.tagGrid}>
            {SLEEP_TAGS.map((tag: string) => {
              const impact = tagImpact[tag];
              const suffix = impact !== undefined ? ` ${impact > 0 ? '+' : ''}${impact}` : '';
              return (
                <GhostButton
                  key={tag}
                  label={`${tag}${suffix}`}
                  onPress={() => toggleTag(tag)}
                  color={selectedTags.includes(tag) ? colors.accent : colors.border}
                  style={styles.tagBtn}
                />
              );
            })}
          </View>
        </Card>

        <PrimaryButton label="Save Sleep →" onPress={save} color={colors.purple} />

        {/* Quick nap */}
        <Card style={styles.napCard}>
          <SectionLabel label="quick nap" />
          <ButtonRow actions={NAP_DURATIONS.map((m: number) => ({
            label: `💤 ${m}m`,
            onPress: () => logNap(m / 60),
            ghost: true,
          }))} />
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen:     { flex: 1, backgroundColor: colors.bg },
  content:    { padding: 16, paddingBottom: 40 },
  heroRow:    { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 12 },
  pills:      { flex: 1, gap: 6 },
  pill:       { fontSize: 13, color: colors.subtext },
  qualHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tagGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tagBtn:     { marginBottom: 0 },
  napCard:    { marginTop: 8 },
  timeRow:    { flexDirection: 'row', gap: 24 },
});
