import type { FreshnessPrediction, PostSurplusFormState } from '../types/postSurplus';

const API_BASE_URL = 'http://localhost:4000';

export async function predictFreshness(
  payload: PostSurplusFormState,
): Promise<FreshnessPrediction> {
  const formData = new FormData();

  if (payload.photo) {
    formData.append('photo', {
      uri: payload.photo.uri,
      name: payload.photo.name ?? 'surplus-food.jpg',
      type: payload.photo.type ?? 'image/jpeg',
    } as never);
  }

  formData.append('foodType', payload.foodType);
  formData.append('quantityKg', payload.quantityKg);
  formData.append('cookTime', payload.cookTime.toISOString());
  formData.append('storageCondition', payload.storageCondition);

  const response = await fetch(`${API_BASE_URL}/api/predict-freshness`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error('Freshness prediction failed');
  }

  return response.json();
}
