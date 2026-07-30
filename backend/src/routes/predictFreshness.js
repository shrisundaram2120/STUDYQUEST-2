const express = require('express');
const multer = require('multer');
const { predictFreshness } = require('../services/freshnessService');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/', upload.single('photo'), async (req, res) => {
  try {
    const { foodType, quantityKg, cookTime, storageCondition } = req.body;

    if (!foodType || !quantityKg || !cookTime || !storageCondition) {
      return res.status(400).json({
        error: 'foodType, quantityKg, cookTime, and storageCondition are required.',
      });
    }

    const prediction = await predictFreshness({
      foodType,
      quantityKg: Number(quantityKg),
      cookTime: new Date(cookTime),
      storageCondition,
      image: req.file,
    });

    return res.status(200).json(prediction);
  } catch (error) {
    return res.status(500).json({
      error: 'Unable to process freshness prediction.',
      detail: error.message,
    });
  }
});

module.exports = router;
