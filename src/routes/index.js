const { Router } = require('express');
const healthRoutes = require('./health.routes');

const router = Router();

router.use('/health', healthRoutes);

// Feature routes get mounted here as they're built, e.g.:
// const workflowRoutes = require('./workflow.routes');
// router.use('/workflows', workflowRoutes);

module.exports = router;
