import type { FoodType, StorageCondition } from '../constants/postSurplus';

export type PhotoAsset = {
  uri: string;
  name?: string;
  type?: string;
};

export type PostSurplusFormState = {
  photo: PhotoAsset | null;
  foodType: FoodType;
  quantityKg: string;
  cookTime: Date;
  storageCondition: StorageCondition;
};

export type FreshnessPrediction = {
  consensusShelfLifeHours: number;
  urgencyBadge: 'Red' | 'Amber' | 'Green';
  tensorFlowShelfLifeHours: number;
  xgBoostShelfLifeHours: number;
  notes: string[];
};
