import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Child } from '../config/api';

interface ChildSelectorProps {
  children: Child[];
  selectedChildId: string | null;
  onSelect: (childId: string) => void;
}

export function ChildSelector({ children, selectedChildId, onSelect }: ChildSelectorProps) {
  if (children.length <= 1) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Select Child</Text>
      <View style={styles.buttonContainer}>
        {children.map((child) => (
          <TouchableOpacity
            key={child.id}
            style={[
              styles.button,
              selectedChildId === child.id && styles.buttonSelected,
            ]}
            onPress={() => onSelect(child.id)}
          >
            <Text
              style={[
                styles.buttonText,
                selectedChildId === child.id && styles.buttonTextSelected,
              ]}
            >
              {child.name} - {child.className}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 16,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: '#111827',
  },
  buttonContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  button: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
  },
  buttonSelected: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  buttonText: {
    fontSize: 14,
    color: '#374151',
  },
  buttonTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
});

