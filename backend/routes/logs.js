const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { checkLogAccess, checkOwner } = require('../middleware/permissions');
const Log = require('../models/Log');

// @route    GET api/logs
// @desc     Get all logs
// @access   Private (owner or admin only)
router.get('/', auth, checkLogAccess, async (req, res) => {
  try {
    const { page = 1, limit = 10, action, userId, startDate, endDate } = req.query;
    
    // Build query
    const query = {};
    
    if (action) {
      query.action = { $regex: action, $options: 'i' };
    }
    
    if (userId) {
      query.user = userId;
    }
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        query.createdAt.$lte = new Date(endDate);
      }
    }
    
    // Calculate pagination
    const skip = (page - 1) * limit;
    
    // Get logs
    const logs = await Log.find(query)
      .populate('user', 'username role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    // Get total count
    const total = await Log.countDocuments(query);
    
    res.json({
      logs,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(total / limit)
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route    GET api/logs/:id
// @desc     Get a single log by ID
// @access   Private (owner or admin only)
router.get('/:id', auth, checkLogAccess, async (req, res) => {
  try {
    const log = await Log.findById(req.params.id)
      .populate('user', 'username role');
    
    if (!log) {
      return res.status(404).json({ msg: '日志不存在' });
    }
    
    res.json(log);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route    DELETE api/logs/:id
// @desc     Delete a log by ID
// @access   Private (owner only)
router.delete('/:id', auth, checkOwner, async (req, res) => {
  try {
    const log = await Log.findById(req.params.id);
    if (!log) {
      return res.status(404).json({ msg: '日志不存在' });
    }
    
    await Log.findByIdAndDelete(req.params.id);
    res.json({ msg: '日志已删除' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route    DELETE api/logs
// @desc     Delete all logs (cleanup)
// @access   Private (owner only)
router.delete('/', auth, checkOwner, async (req, res) => {
  try {
    await Log.deleteMany({});
    res.json({ msg: '所有日志已删除' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;