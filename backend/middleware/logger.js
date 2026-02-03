const Log = require('../models/Log');

// Log action middleware
const logAction = async (req, res, next) => {
  try {
    const { action, details } = req.body;
    const user = req.user;
    const ip = req.ip;
    const userAgent = req.get('User-Agent');

    if (action) {
      const log = new Log({
        action,
        user: user.id,
        details,
        ip,
        userAgent
      });

      await log.save();
    }
  } catch (err) {
    console.error('Error logging action:', err.message);
  }
  next();
};

// Logger middleware for API requests
const logger = async (req, res, next) => {
  try {
    // Skip logging for certain routes (e.g., static files)
    if (req.path.startsWith('/uploads') || req.path.startsWith('/socket.io')) {
      return next();
    }

    const user = req.user;
    const ip = req.ip;
    const userAgent = req.get('User-Agent');
    const method = req.method;
    const path = req.path;
    const query = req.query;

    // Create log entry
    const log = new Log({
      action: `API Request: ${method} ${path}`,
      user: user ? user.id : null,
      details: {
        method,
        path,
        query,
        body: req.body
      },
      ip,
      userAgent
    });

    await log.save();
  } catch (err) {
    console.error('Error logging request:', err.message);
  }
  next();
};

module.exports = {
  logAction,
  logger
};