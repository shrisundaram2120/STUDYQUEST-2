import React, { useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import {
  COLORS,
  FOOD_TYPE_OPTIONS,
  type FoodType,
  type StorageCondition,
} from '../constants/postSurplus';
import { StorageConditionChips } from '../components/StorageConditionChips';
import { predictFreshness } from '../services/surplusApi';
import type { FreshnessPrediction, PhotoAsset } from '../types/postSurplus';

async function launchCameraCapture(): Promise<PhotoAsset | null> {
  // Replace with ImagePicker.launchCameraAsync or react-native-image-picker in production.
  return Promise.resolve({
    uri: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836',
    name: 'surplus-food.jpg',
    type: 'image/jpeg',
  });
}

function formatTime(date: Date) {
  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function PostSurplusScreen() {
  const [photo, setPhoto] = useState<PhotoAsset | null>(null);
  const [foodType, setFoodType] = useState<FoodType>('Cooked Rice');
  const [quantityKg, setQuantityKg] = useState('');
  const [cookTime, setCookTime] = useState(new Date());
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [storageCondition, setStorageCondition] =
    useState<StorageCondition>('Room Temperature');
  const [loading, setLoading] = useState(false);
  const [prediction, setPrediction] = useState<FreshnessPrediction | null>(null);

  const handlePhotoUpload = async () => {
    const nextPhoto = await launchCameraCapture();

    if (nextPhoto) {
      setPhoto(nextPhoto);
    }
  };

  const handleSubmit = async () => {
    if (!photo) {
      Alert.alert('Photo required', 'Capture a food image before submitting.');
      return;
    }

    if (!quantityKg || Number.isNaN(Number(quantityKg)) || Number(quantityKg) <= 0) {
      Alert.alert('Invalid quantity', 'Enter a valid quantity in kilograms.');
      return;
    }

    setLoading(true);

    try {
      const result = await predictFreshness({
        photo,
        foodType,
        quantityKg,
        cookTime,
        storageCondition,
      });

      setPrediction(result);
    } catch (error) {
      Alert.alert('Submission failed', 'Unable to predict freshness right now.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{ padding: 20, backgroundColor: COLORS.background }}
    >
      <Text className="mb-2 text-3xl font-bold" style={{ color: COLORS.text }}>
        Post Surplus
      </Text>
      <Text className="mb-8 text-base" style={{ color: COLORS.textMuted }}>
        Submit leftover food for NGO pickup and AI freshness assessment.
      </Text>

      <View
        className="mb-5 rounded-3xl border p-4"
        style={{ backgroundColor: COLORS.surface, borderColor: COLORS.border }}
      >
        <Text className="mb-3 text-sm font-semibold" style={{ color: COLORS.textMuted }}>
          Photo Upload
        </Text>
        <Pressable
          onPress={handlePhotoUpload}
          className="items-center rounded-2xl px-4 py-4"
          style={{ backgroundColor: COLORS.primary }}
        >
          <Text className="text-base font-semibold" style={{ color: COLORS.text }}>
            Open Camera
          </Text>
        </Pressable>

        {photo ? (
          <Image
            source={{ uri: photo.uri }}
            className="mt-4 h-48 w-full rounded-2xl"
            resizeMode="cover"
          />
        ) : (
          <Text className="mt-4 text-sm" style={{ color: COLORS.textMuted }}>
            No image captured yet.
          </Text>
        )}
      </View>

      <View
        className="mb-5 rounded-3xl border p-4"
        style={{ backgroundColor: COLORS.surface, borderColor: COLORS.border }}
      >
        <Text className="mb-3 text-sm font-semibold" style={{ color: COLORS.textMuted }}>
          Food Type
        </Text>
        <View
          className="overflow-hidden rounded-2xl border"
          style={{ borderColor: COLORS.border, backgroundColor: COLORS.surfaceAlt }}
        >
          <Picker
            selectedValue={foodType}
            dropdownIconColor={COLORS.text}
            onValueChange={(value) => setFoodType(value as FoodType)}
            style={{ color: COLORS.text }}
          >
            {FOOD_TYPE_OPTIONS.map((option) => (
              <Picker.Item key={option} label={option} value={option} />
            ))}
          </Picker>
        </View>
      </View>

      <View
        className="mb-5 rounded-3xl border p-4"
        style={{ backgroundColor: COLORS.surface, borderColor: COLORS.border }}
      >
        <Text className="mb-3 text-sm font-semibold" style={{ color: COLORS.textMuted }}>
          Quantity (kg)
        </Text>
        <TextInput
          value={quantityKg}
          onChangeText={setQuantityKg}
          keyboardType="numeric"
          placeholder="e.g. 12.5"
          placeholderTextColor={COLORS.textMuted}
          className="rounded-2xl border px-4 py-4 text-base"
          style={{
            color: COLORS.text,
            backgroundColor: COLORS.surfaceAlt,
            borderColor: COLORS.border,
          }}
        />
      </View>

      <View
        className="mb-5 rounded-3xl border p-4"
        style={{ backgroundColor: COLORS.surface, borderColor: COLORS.border }}
      >
        <Text className="mb-3 text-sm font-semibold" style={{ color: COLORS.textMuted }}>
          Cook Time
        </Text>
        <Pressable
          onPress={() => setShowTimePicker(true)}
          className="rounded-2xl border px-4 py-4"
          style={{ borderColor: COLORS.border, backgroundColor: COLORS.surfaceAlt }}
        >
          <Text className="text-base" style={{ color: COLORS.text }}>
            {formatTime(cookTime)}
          </Text>
        </Pressable>

        {showTimePicker ? (
          <DateTimePicker
            value={cookTime}
            mode="time"
            display="default"
            onChange={(_, selectedDate) => {
              setShowTimePicker(false);
              if (selectedDate) {
                setCookTime(selectedDate);
              }
            }}
          />
        ) : null}
      </View>

      <View
        className="mb-8 rounded-3xl border p-4"
        style={{ backgroundColor: COLORS.surface, borderColor: COLORS.border }}
      >
        <Text className="mb-3 text-sm font-semibold" style={{ color: COLORS.textMuted }}>
          Storage Condition
        </Text>
        <StorageConditionChips
          value={storageCondition}
          onChange={setStorageCondition}
        />
      </View>

      <Pressable
        onPress={handleSubmit}
        disabled={loading}
        className="items-center rounded-2xl px-4 py-4"
        style={{
          backgroundColor: loading ? COLORS.primaryMuted : COLORS.primary,
          opacity: loading ? 0.7 : 1,
        }}
      >
        <Text className="text-base font-bold" style={{ color: COLORS.text }}>
          {loading ? 'Analyzing...' : 'Submit Surplus'}
        </Text>
      </Pressable>

      {prediction ? (
        <View
          className="mt-8 rounded-3xl border p-4"
          style={{ backgroundColor: COLORS.surface, borderColor: COLORS.border }}
        >
          <Text className="mb-3 text-xl font-bold" style={{ color: COLORS.text }}>
            Freshness Result
          </Text>
          <Text className="mb-2 text-sm" style={{ color: COLORS.textMuted }}>
            Consensus shelf life: {prediction.consensusShelfLifeHours.toFixed(1)} hrs
          </Text>
          <Text className="mb-2 text-sm" style={{ color: COLORS.textMuted }}>
            Urgency badge: {prediction.urgencyBadge}
          </Text>
          <Text className="text-sm" style={{ color: COLORS.textMuted }}>
            AI notes: {prediction.notes.join(' ')}
          </Text>
        </View>
      ) : null}
    </ScrollView>
  );
}
