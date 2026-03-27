import React, { useEffect, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View, Button, Alert } from 'react-native';
import { getHealth, generateIntervention, createMeal, createSleep, createActivity } from './src/api';

type Intervention = {
  id: number;
  title: string;
  message: string;
  confidence_score: number;
  status: string;
};

const USER_ID = 1;

export default function App() {
  const [health, setHealth] = useState('loading');
  const [intervention, setIntervention] = useState<Intervention | null>(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [text, setText] = useState('');

  useEffect(() => {
    getHealth()
      .then((h) => setHealth(h.status || 'unknown'))
      .catch((error) => {
        console.warn('Health check failed', error);
        setHealth('offline');
      });
  }, []);

  const onGenerate = async () => {
    try {
      const result = await generateIntervention(USER_ID);
      if (result?.detail) {
        setStatusMessage(result.detail);
        setIntervention(null);
        return;
      }
      setIntervention(result as Intervention);
      setStatusMessage('Intervention generated');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setStatusMessage(`Error: ${message}`);
      Alert.alert('Error', message);
      setIntervention(null);
    }
  };

  const onLogMeal = async () => {
    await createMeal(USER_ID, {
      meal_time: new Date().toISOString(),
      meal_type: 'snack',
      description: 'Example snack',
      calories: 200,
    });
    Alert.alert('Meal logged');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Alfred Pennyworth Mobile</Text>
        <Text style={styles.subtitle}>Backend health: {health}</Text>

        <View style={styles.card}>
          <Button title="Generate Intervention" onPress={onGenerate} />
          {intervention && (
            <View style={styles.intervention}>
              <Text style={styles.interventionTitle}>{intervention.title}</Text>
              <Text>{intervention.message}</Text>
              <Text style={styles.interventionMeta}>confidence: {Number(intervention.confidence_score).toFixed(2)}</Text>
              <Text style={styles.interventionMeta}>status: {intervention.status}</Text>
            </View>
          )}
        </View>

        <View style={styles.card}>
          <Button title="Log Example Meal" onPress={onLogMeal} />
        </View>

        <View style={styles.card}>
          <Button title="Log Example Sleep" onPress={async () => {
            await createSleep(USER_ID, {
              sleep_start: new Date(Date.now() - 8*60*60000).toISOString(),
              sleep_end: new Date().toISOString(),
              quality_score: 87,
            });
            Alert.alert('Sleep logged');
          }} />
        </View>

        <View style={styles.card}>
          <Button title="Log Example Activity" onPress={async () => {
            await createActivity(USER_ID, {
              activity_type: 'walking',
              start_time: new Date(Date.now() - 30*60000).toISOString(),
              duration_minutes: 30,
              calories_burned: 150,
            });
            Alert.alert('Activity logged');
          }} />
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Notes:</Text>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder="Reminder, etc."
            multiline
          />
        </View>

        {statusMessage ? (
          <View style={styles.statusBar}>
            <Text style={styles.statusText}>{statusMessage}</Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f4f7fb',
  },
  content: {
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    marginBottom: 16,
    color: '#374151',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 4,
  },
  intervention: {
    marginTop: 10,
  },
  statusBar: {
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
  },
  statusText: {
    color: '#1d4ed8',
  },
  interventionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  interventionMeta: {
    marginTop: 4,
    fontSize: 12,
    color: '#6b7280',
  },
  label: {
    marginBottom: 6,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 10,
    backgroundColor: '#fff',
  },
});
