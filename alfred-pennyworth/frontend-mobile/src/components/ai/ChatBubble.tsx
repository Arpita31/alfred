import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ChatMessage } from '../../types/intervention';
import { colors } from '../../theme/colors';

interface Props { message: ChatMessage }

export function ChatBubble({ message }: Props) {
  const isUser = message.role === 'user';
  return (
    <View style={[styles.bubble, isUser ? styles.userBubble : styles.alfredBubble]}>
      <Text style={styles.text}>{message.text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bubble:       { maxWidth: '80%', borderRadius: 14, padding: 12, marginVertical: 4 },
  userBubble:   { backgroundColor: colors.blue, alignSelf: 'flex-end' },
  alfredBubble: { backgroundColor: colors.surface, alignSelf: 'flex-start' },
  text:         { color: colors.text, fontSize: 14, lineHeight: 20 },
});
