const BASE_SHELF_LIFE_HOURS = {
  'Cooked Rice': 6,
  Curry: 5,
  Bread: 12,
  Dairy: 4,
  Fruits: 10,
  'Sealed Packets': 24,
};

function estimateAmbientTemperature(storageCondition) {
  switch (storageCondition) {
    case 'Frozen':
      return -5;
    case 'Refrigerated':
      return 4;
    case 'Room Temperature':
    default:
      return 28;
  }
}

async function runXGBoostShelfLifeModel({ foodType, storageCondition }) {
  // Placeholder: replace with real feature engineering + XGBoost inference.
  const baseHours = BASE_SHELF_LIFE_HOURS[foodType] ?? 6;
  const temperature = estimateAmbientTemperature(storageCondition);

  let modifier = 1;

  if (temperature >= 25) modifier = 0.55;
  if (temperature <= 4) modifier = 1.3;
  if (temperature < 0) modifier = 1.6;

  return Number((baseHours * modifier).toFixed(1));
}

async function runTensorFlowSpoilageModel({ foodType, image }) {
  // Placeholder: replace with TensorFlow CNN image preprocessing + classification.
  const defaultSignals = {
    'Cooked Rice': 5.4,
    Curry: 4.8,
    Bread: 11.2,
    Dairy: 3.7,
    Fruits: 9.1,
    'Sealed Packets': 20.5,
  };

  const hasImage = Boolean(image);
  const baseline = defaultSignals[foodType] ?? 6;

  return Number((hasImage ? baseline : baseline - 1.5).toFixed(1));
}

function calculateConsensusShelfLife(xgBoostHours, tensorFlowHours) {
  return Number((((xgBoostHours + tensorFlowHours) / 2)).toFixed(1));
}

function getUrgencyBadge(consensusShelfLifeHours) {
  if (consensusShelfLifeHours < 2) {
    return 'Red';
  }

  // Treat 2-6 hours as cautionary to avoid surfacing a false "Green" state.
  if (consensusShelfLifeHours < 6) {
    return 'Amber';
  }

  return 'Green';
}

async function predictFreshness({ foodType, storageCondition, image }) {
  const xgBoostShelfLifeHours = await runXGBoostShelfLifeModel({
    foodType,
    storageCondition,
  });

  const tensorFlowShelfLifeHours = await runTensorFlowSpoilageModel({
    foodType,
    image,
  });

  const consensusShelfLifeHours = calculateConsensusShelfLife(
    xgBoostShelfLifeHours,
    tensorFlowShelfLifeHours,
  );

  return {
    xgBoostShelfLifeHours,
    tensorFlowShelfLifeHours,
    consensusShelfLifeHours,
    urgencyBadge: getUrgencyBadge(consensusShelfLifeHours),
    notes: [
      'XGBoost placeholder uses food type and storage temperature heuristics.',
      'TensorFlow placeholder assumes image-based spoilage scoring.',
    ],
  };
}

module.exports = {
  predictFreshness,
};
