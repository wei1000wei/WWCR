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

    // Create new user
    user = new User({ 
      username, 
      password, 
      realName, 
      phone,
      role: 'user',
      isVerified: false
    });

    // Hash password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);

    // Save user
    await user.save();

    // Return success message
    res.json({ msg: '注册成功！请等待管理员验证。' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
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
    if (!user) {
      return res.status(400).json({ msg: '用户名或密码错误' });
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
        role: user.role
      } 
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '1h' },
      (err, token) => {
        if (err) throw err;
        res.json({ 
          token, 
          user: { 
            id: user.id, 
            username: user.username, 
            role: user.role,
            realName: user.realName,
            phone: user.phone
          } 
        });
      }
    );
  } catch (err) {
    console.error(err.message);
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

module.exports = router;