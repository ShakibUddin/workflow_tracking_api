const { Router } = require('express');

const router = Router();

/**
 * @openapi
 * /health:
 *   get:
 *     summary: Health check
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service is healthy
 */
router.get('/', (req, res) => {
  res.json({ success: true, message: 'OK', timestamp: new Date().toISOString() });
});

module.exports = router;
