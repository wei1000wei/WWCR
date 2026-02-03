const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { checkRole, checkOwner } = require('../middleware/permissions');
const User = require('../models/User');

// @route    GET api/permissions/roles
// @desc     Get all available roles
// @access   Private (admin or higher)
router.get('/roles', auth, checkRole('admin'), async (req, res) => {
  try {
    const roles = ['user', 'moderator', 'admin', 'owner'];
    res.json({ roles });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route    GET api/permissions/available
// @desc     Get all available permissions
// @access   Private (admin or higher)
router.get('/available', auth, checkRole('admin'), async (req, res) => {
  try {
    const permissions = [
      'send_messages',
      'join_groups',
      'upload_files',
      'kick_users',
      'ban_users',
      'manage_messages',
      'view_logs',
      'manage_users',
      'manage_groups',
      'manage_announcements',
      'manage_blacklist',
      'manage_permissions'
    ];
    res.json({ permissions });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route    PUT api/permissions/user/:userId
// @desc     Update user permissions
// @access   Private (admin or higher)
router.put('/user/:userId', auth, checkRole('admin'), async (req, res) => {
  try {
    const { permissions, role } = req.body;
    
    // Prevent updating owner role
    if (role === 'owner' && req.user.role !== 'owner') {
      return res.status(403).json({ msg: '只有 owner 可以设置 owner 角色' });
    }
    
    // Update user
    const updatedUser = await User.findByIdAndUpdate(
      req.params.userId,
      { permissions, role },
      { new: true }
    );
    
    if (!updatedUser) {
      return res.status(404).json({ msg: '用户不存在' });
    }
    
    res.json({ msg: '用户权限已更新', user: {
      id: updatedUser.id,
      username: updatedUser.username,
      role: updatedUser.role,
      permissions: updatedUser.permissions
    }});
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route    GET api/permissions/user/:userId
// @desc     Get user permissions
// @access   Private (admin or higher)
router.get('/user/:userId', auth, checkRole('admin'), async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    
    if (!user) {
      return res.status(404).json({ msg: '用户不存在' });
    }
    
    res.json({ user: {
      id: user.id,
      username: user.username,
      role: user.role,
      permissions: user.permissions
    }});
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
