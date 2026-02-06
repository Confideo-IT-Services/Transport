import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export function EmptyState({ message }: { message: string }) {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  text: {
    color: '#6b7280',
    fontSize: 14,
    textAlign: 'center',
  },
});

