import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { COLORS, STORAGE_CONDITIONS, type StorageCondition } from '../constants/postSurplus';

type Props = {
  value: StorageCondition;
  onChange: (next: StorageCondition) => void;
};

export function StorageConditionChips({ value, onChange }: Props) {
  return (
    <View className="flex-row flex-wrap gap-3">
      {STORAGE_CONDITIONS.map((option) => {
        const selected = option === value;

        return (
          <Pressable
            key={option}
            onPress={() => onChange(option)}
            className="rounded-full border px-4 py-2"
            style={{
              backgroundColor: selected ? COLORS.primary : COLORS.surface,
              borderColor: selected ? COLORS.primaryMuted : COLORS.border,
            }}
          >
            <Text
              className="text-sm font-semibold"
              style={{ color: selected ? COLORS.text : COLORS.textMuted }}
            >
              {option}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
