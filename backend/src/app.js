const express = require('express');
const predictFreshnessRouter = require('./routes/predictFreshness');

const app = express();

app.use(express.json());
app.use('/api/predict-freshness', predictFreshnessRouter);

module.exports = app;
