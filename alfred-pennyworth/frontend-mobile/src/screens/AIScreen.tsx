import { useEffect } from 'react';
import { ScrollView, View, Text, FlatList, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useAIChat } from '../hooks/useAIChat';
import { InterventionCard } from '../components/ai/InterventionCard';
import { ChatBubble } from '../components/ai/ChatBubble';
import { ChatInput } from '../components/ai/ChatInput';
import { ScreenHeader } from '../components/common/ScreenHeader';
import { Card } from '../components/common/Card';
import { GhostButton } from '../components/common/GhostButton';
import { SectionLabel } from '../components/common/SectionLabel';
import { EmptyState } from '../components/common/EmptyState';
import { colors } from '../theme/colors';
import { QUICK_CHAT_PROMPTS } from '../constants/options';

export function AIScreen() {
  const { messages, intervention, chatInput, loading, setChatInput, sendMessage, respondToIntervention, refresh } = useAIChat();

  useEffect(() => { refresh(); }, []);

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScreenHeader title="Alfred AI" subtitle="Personal AI wellness advisor." />

        {/* Orb hero */}
        <Card style={styles.orbCard}>
          <Text style={styles.orb}>✦</Text>
          <Text style={styles.orbTitle}>
            {loading ? 'Analysing your patterns…' : 'Insights update automatically'}
          </Text>
          <Text style={styles.orbSub}>
            Alfred monitors nutrition, sleep, hydration and activity in real time to surface the most impactful action.
          </Text>
          {loading
            ? <ActivityIndicator color={colors.accent} style={styles.loader} />
            : <GhostButton label="↻ Refresh Insight" onPress={refresh} color={colors.accent} style={styles.refreshBtn} />
          }
        </Card>

        {/* AI Intervention */}
        {intervention && (
          <InterventionCard intervention={intervention} onRespond={respondToIntervention} />
        )}

        {/* Chat */}
        <Card>
          <SectionLabel label="chat with alfred" />

          {messages.length === 0 ? (
            <EmptyState icon="💬" message="Ask Alfred anything about your health, habits, or goals." />
          ) : (
            <View>
              {messages.map((m, i) => <ChatBubble key={i} message={m} />)}
              {loading && (
                <View style={styles.thinkingBubble}>
                  <ActivityIndicator color={colors.accent} size="small" />
                </View>
              )}
            </View>
          )}

          {/* Quick prompts */}
          <View style={styles.promptRow}>
            {QUICK_CHAT_PROMPTS.map(q => (
              <GhostButton key={q} label={q} onPress={() => sendMessage(q)} color={colors.muted} style={styles.promptBtn} />
            ))}
          </View>
        </Card>
      </ScrollView>

      {/* Sticky chat input */}
      <ChatInput value={chatInput} onChange={setChatInput} onSend={() => sendMessage()} disabled={loading} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen:        { flex: 1, backgroundColor: colors.bg },
  content:       { padding: 16, paddingBottom: 8 },
  orbCard:       { alignItems: 'center', paddingVertical: 28 },
  orb:           { fontSize: 40, color: colors.accent },
  orbTitle:      { color: colors.text, fontWeight: '700', fontSize: 16, marginTop: 12, textAlign: 'center' },
  orbSub:        { color: colors.muted, fontSize: 12, textAlign: 'center', marginTop: 6, maxWidth: 280, lineHeight: 18 },
  loader:        { marginTop: 16 },
  refreshBtn:    { marginTop: 4, alignSelf: 'center' },
  thinkingBubble:{ backgroundColor: colors.surface3, borderRadius: 12, padding: 12, alignSelf: 'flex-start', marginBottom: 8 },
  promptRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  promptBtn:     { marginBottom: 0 },
});
