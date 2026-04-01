import { ScrollView, StyleSheet } from 'react-native';
import { useHydration } from '../hooks/useHydration';
import { ScreenHeader } from '../components/common/ScreenHeader';
import { WaterProgress } from '../components/hydration/WaterProgress';
import { AddWaterButtons } from '../components/hydration/AddWaterButtons';
import { Card } from '../components/common/Card';
import { DataCard } from '../components/common/DataCard';
import { InfoChipRow } from '../components/common/InfoChipRow';
import { SectionLabel } from '../components/common/SectionLabel';
import { ListItem } from '../components/common/ListItem';
import { ProgressBar } from '../components/common/ProgressBar';
import { colors } from '../theme/colors';
import { getProgressColor } from '../lib/ui/statusColor';
import { WaterHistory } from '../types/health';

export function HydrationScreen() {
  const { totalMl, goalMl, pct, remaining, endOfDayPrediction, consistencyScore, history, addWater } = useHydration();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <ScreenHeader title="Hydration" subtitle="Track daily water intake & habits" />

      <WaterProgress totalMl={totalMl} goalMl={goalMl} pct={pct} remaining={remaining} />

      <Card>
        <SectionLabel label="intel" />
        <InfoChipRow chips={[
          { label: 'GOAL',        value: `${(goalMl / 1000).toFixed(1)} L`,              color: colors.blue },
          { label: 'EOD EST.',    value: `${(endOfDayPrediction / 1000).toFixed(1)} L`,  color: endOfDayPrediction >= goalMl ? colors.green : colors.orange },
          { label: '14-DAY',      value: `${consistencyScore}%`,                         color: getProgressColor(consistencyScore, [70, 40]) },
        ]} />
      </Card>

      <Card>
        <SectionLabel label="log water" />
        <AddWaterButtons onAdd={addWater} />
      </Card>

      <DataCard label="last 7 days" isEmpty={history.length === 0} emptyIcon="💧" emptyMessage="Log water to see your history here.">
        {history.slice(0, 7).map((d: WaterHistory, i: number) => {
          const p = Math.min(100, (d.totalMl / (d.goalMl || goalMl)) * 100);
          return (
            <ListItem
              key={i}
              primary={d.date}
              value={`${(d.totalMl / 1000).toFixed(1)} L`}
              valueColor={getProgressColor(p)}
              secondary={<ProgressBar pct={p} color={getProgressColor(p)} height={4} />}
            />
          );
        })}
      </DataCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 32 },
});
