import { ScrollView, View, StyleSheet } from 'react-native';
import { useDashboard } from '../hooks/useDashboard';
import { ScreenHeader } from '../components/common/ScreenHeader';
import { StatCard } from '../components/dashboard/StatCard';
import { InfoChipRow } from '../components/common/InfoChipRow';
import { Card } from '../components/common/Card';
import { colors } from '../theme/colors';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

function StatusDot({ online }: { online: boolean }) {
  return <View style={[styles.dot, { backgroundColor: online ? colors.green : colors.red }]} />;
}

export function DashboardScreen() {
  const { netWorth, savingsRate, sleepScore, recovery, waterPct, apiOnline } = useDashboard();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <ScreenHeader
        title={`${greeting()}.`}
        subtitle={new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        right={<StatusDot online={apiOnline} />}
      />

      <Card>
        <InfoChipRow chips={[
          { label: 'NET WORTH',    value: netWorth,       color: colors.green },
          { label: 'SAVINGS RATE', value: `${savingsRate}%`, color: colors.blue },
        ]} />
      </Card>

      <View style={styles.grid}>
        <StatCard label="Sleep Score" value={sleepScore !== null ? `${sleepScore}` : '—'} color={colors.purple} />
        <StatCard label="Recovery"    value={recovery ? `${recovery.score}` : '—'} color={recovery?.color ?? colors.muted} sub={recovery?.label} />
        <StatCard label="Hydration"   value={`${waterPct}%`} color={colors.blue} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 32 },
  dot:     { width: 10, height: 10, borderRadius: 5 },
  grid:    { flexDirection: 'row' },
});
