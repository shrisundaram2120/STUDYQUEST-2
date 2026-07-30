export const COLORS = {
  background: '#1B2E1C',
  surface: '#243B26',
  surfaceAlt: '#315234',
  primary: '#2E7D32',
  primaryMuted: '#3E8E41',
  text: '#F3F7F1',
  textMuted: '#B7C7B4',
  border: '#4F6E52',
  danger: '#D64C4C',
} as const;

export const FOOD_TYPE_OPTIONS = [
  'Cooked Rice',
  'Curry',
  'Bread',
  'Dairy',
  'Fruits',
  'Sealed Packets',
] as const;

export const STORAGE_CONDITIONS = [
  'Room Temperature',
  'Refrigerated',
  'Frozen',
] as const;

export type FoodType = (typeof FOOD_TYPE_OPTIONS)[number];
export type StorageCondition = (typeof STORAGE_CONDITIONS)[number];
