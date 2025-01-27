const express = require('express');
const router = express.Router();
const { getChartData } = require('../controllers/admin/chartController');

// Chart data route
router.get('/chart-data', getChartData);

module.exports = router;
