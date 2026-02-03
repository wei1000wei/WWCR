const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const auth = require('../middleware/auth');
const User = require('../models/User');

// @route    POST api/auth/register
// @desc     Register user
// @access   Public
router.post('/register', async (req, res) => {
  const { username, password, realName, phone } = req.body;

  try {
    // Check if username is already taken
    let user = await User.findOne({ username });
    if (user) {
      return res.status(400).json({ msg: '用户名已被占用' });
    }

    // Check if there's any owner user
    let ownerCount = 0;
    try {
      ownerCount = await User.countDocuments({ role: 'owner' });
    } catch (dbErr) {
      console.log('Database error when checking owner count, assuming no owners:', dbErr.message);
      // If database error, assume no owners yet
    }
    
    // Determine user role and verification status
    const role = ownerCount === 0 ? 'owner' : 'user';
    const isVerified = ownerCount === 0 ? true : false;

    // Create new user
    user = new User({ 
      username, 
      password, 
      realName, 
      phone,
      role,
      isVerified
    });

    // Hash password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);

    // Save user
    await user.save();

    // Return appropriate success message
    const successMsg = ownerCount === 0 
      ? '注册成功！您已成为系统所有者，无需验证。' 
      : '注册成功！请等待管理员验证。';
      
    res.json({ msg: successMsg });
  } catch (err) {
    console.error('Register error:', err.message);
    
    // Handle database connection error
    if (err.name === 'MongoServerError' || err.name === 'MongooseError') {
      return res.status(400).json({ 
        msg: '注册失败，请检查数据库连接或尝试使用演示账户登录。' 
      });
    }
    
    res.status(500).json({ msg: '注册失败，请重试。' });
  }
});

// @route    POST api/auth/login
// @desc     Authenticate user & get token
// @access   Public
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    // Find user by username
    let user = await User.findOne({ username });
    
    // Demo mode: If user not found or database connection failed, use demo admin account
    if (!user) {
      // Check if it's admin login attempt in demo mode
      if (username === 'admin' && password === 'admin123') {
        // Create demo admin user
        user = {
          id: 'demo-admin-123',
          username: 'admin',
          role: 'admin',
          permissions: ['manage_users', 'manage_groups', 'view_logs', 'manage_announcements', 'manage_blacklist'],
          realName: '管理员',
          phone: '1234567890',
          isVerified: true
        };
        
        // Generate token for demo user
        const payload = { 
          user: { 
            id: user.id,
            role: user.role,
            permissions: user.permissions
          } 
        };

        jwt.sign(
          payload,
          process.env.JWT_SECRET || 'demo-secret-key',
          { expiresIn: '1h' },
          (err, token) => {
            if (err) throw err;
            res.json({ 
              token, 
              user: {
                id: user.id, 
                username: user.username, 
                role: user.role,
                permissions: user.permissions,
                realName: user.realName,
                phone: user.phone
              } 
            });
          }
        );
        return;
      } else {
        return res.status(400).json({ msg: '用户名或密码错误' });
      }
    }

    // Check if user is verified
    if (!user.isVerified) {
      return res.status(400).json({ msg: '您的账号尚未验证，请等待管理员批准。' });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ msg: 'Invalid Credentials' });
    }

    // Generate token
    const payload = { 
      user: { 
        id: user.id,
        role: user.role,
        permissions: user.permissions || []
      } 
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET || 'demo-secret-key',
      { expiresIn: '1h' },
      (err, token) => {
        if (err) throw err;
        res.json({ 
          token, 
          user: { 
            id: user.id, 
            username: user.username, 
            role: user.role,
            permissions: user.permissions || [],
            realName: user.realName,
            phone: user.phone
          } 
        });
      }
    );
  } catch (err) {
    console.error(err.message);
    
    // Demo mode: If database connection failed, use demo admin account
    if (err.name === 'MongoServerError' || err.name === 'MongooseError') {
      if (username === 'admin' && password === 'admin123') {
        // Create demo admin user
        const user = {
          id: 'demo-admin-123',
          username: 'admin',
          role: 'admin',
          permissions: ['manage_users', 'manage_groups', 'view_logs', 'manage_announcements', 'manage_blacklist'],
          realName: '管理员',
          phone: '1234567890',
          isVerified: true
        };
        
        // Generate token for demo user
        const payload = { 
          user: { 
            id: user.id,
            role: user.role,
            permissions: user.permissions
          } 
        };

        jwt.sign(
          payload,
          process.env.JWT_SECRET || 'demo-secret-key',
          { expiresIn: '1h' },
          (err, token) => {
            if (err) {
              console.error(err.message);
              return res.status(500).send('Server Error');
            }
            res.json({ 
              token, 
              user: {
                id: user.id, 
                username: user.username, 
                role: user.role,
                permissions: user.permissions,
                realName: user.realName,
                phone: user.phone
              } 
            });
          }
        );
        return;
      }
    }
    
    res.status(500).send('Server Error');
  }
});

// @route    GET api/auth/me
// @desc     Get user by token
// @access   Private
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json(user);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route    GET api/auth/users
// @desc     Get all users (for admin/owner)
// @access   Private (admin/owner only)
router.get('/users', auth, async (req, res) => {
  try {
    // Check if user is admin or owner
    const currentUser = await User.findById(req.user.id);
    if (currentUser.role !== 'admin' && currentUser.role !== 'owner') {
      return res.status(403).json({ msg: '没有权限' });
    }

    // Get all users
    const users = await User.find().select('-password');
    res.json(users);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route    GET /api/auth/user/:username
// @desc     Get user by username
// @access   Private
router.get('/user/:username', auth, async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username }).select('-password');
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }
    res.json(user);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route    GET /api/auth/users/search
// @desc     Search users by username or realName
// @access   Private
router.get('/users/search', auth, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.status(400).json({ msg: '搜索参数不能为空' });
    }

    // Search users by username or realName containing the query
    const users = await User.find({
      $or: [
        { username: { $regex: q, $options: 'i' } },
        { realName: { $regex: q, $options: 'i' } }
      ]
    }).select('-password');

    res.json(users);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route    PUT api/auth/users/:id/verify
// @desc     Verify a user (for admin/owner)
// @access   Private (admin/owner only)
router.put('/users/:id/verify', auth, async (req, res) => {
  try {
    // Check if user is admin or owner
    const currentUser = await User.findById(req.user.id);
    if (currentUser.role !== 'admin' && currentUser.role !== 'owner') {
      return res.status(403).json({ msg: 'Not authorized' });
    }

    // Update user status
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isVerified: true },
      { new: true }
    ).select('-password');

    res.json(user);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route    PUT api/auth/users/:id/role
// @desc     Change user role (for owner only)
// @access   Private (owner only)
router.put('/users/:id/role', auth, async (req, res) => {
  try {
    // Check if user is owner
    const currentUser = await User.findById(req.user.id);
    if (currentUser.role !== 'owner') {
      return res.status(403).json({ msg: 'Not authorized' });
    }

    // Update user role
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role: req.body.role },
      { new: true }
    ).select('-password');

    res.json(user);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route    POST api/auth/logout
// @desc     Logout user
// @access   Private
router.post('/logout', auth, (req, res) => {
  // In a real app, you might want to invalidate the token in a database
  res.json({ msg: '用户已登出' });
});

// @route    DELETE api/auth/users/:id
// @desc     Delete user
// @access   Private (admin/owner only)
router.delete('/users/:id', auth, async (req, res) => {
  try {
    // Get current user
    const currentUser = await User.findById(req.user.id);
    
    // Check if current user is admin or owner
    if (currentUser.role !== 'admin' && currentUser.role !== 'owner') {
      return res.status(403).json({ msg: '没有权限删除用户' });
    }
    
    // Get user to delete
    const userToDelete = await User.findById(req.params.id);
    if (!userToDelete) {
      return res.status(404).json({ msg: '用户不存在' });
    }
    
    // Check if user to delete is owner
    if (userToDelete.role === 'owner') {
      return res.status(403).json({ msg: '不能删除系统所有者' });
    }
    
    // Check if admin is trying to delete another admin
    if (currentUser.role === 'admin' && userToDelete.role === 'admin') {
      return res.status(403).json({ msg: '管理员不能删除其他管理员' });
    }
    
    // Delete user
    await User.findByIdAndDelete(req.params.id);
    
    res.json({ msg: '用户已删除' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
