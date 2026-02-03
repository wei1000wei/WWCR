const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Message = require('../models/Message');
const Group = require('../models/Group');
const { getIO } = require('../config/socket');
const upload = require('../config/upload');
const path = require('path');
const fs = require('fs');

// HTML转义函数，防止XSS攻击
const escapeHtml = (text) => {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

// @route    GET api/messages/:groupId
// @desc     Get all messages for a group
// @access   Private
router.get('/:groupId', auth, async (req, res) => {
  try {
    const group = await Group.findById(req.params.groupId);
    if (!group) {
      return res.status(404).json({ msg: '群组不存在' });
    }

    // Check if user is a member
    if (!group.members.some(member => member.toString() === req.user.id)) {
      return res.status(403).json({ msg: '没有权限' });
    }

    const messages = await Message.find({ group: req.params.groupId })
      .populate('sender', 'username')
      .populate('replyTo', 'sender content fileName')
      .populate('replyTo.sender', 'username')
      .sort({ createdAt: 1 });

    res.json(messages);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route    POST api/messages/:groupId
// @desc     Send a message to a group
// @access   Private
router.post('/:groupId', auth, async (req, res) => {
  const { content, replyTo } = req.body;

  try {
    const group = await Group.findById(req.params.groupId);
    if (!group) {
      return res.status(404).json({ msg: '群组不存在' });
    }

    // Check if user is a member
    if (!group.members.some(member => member.toString() === req.user.id)) {
      return res.status(403).json({ msg: '没有权限' });
    }

    // 获取群组所有成员
    const groupMembers = group.members;
    
    // 初始化每个成员的阅读状态
    const readStatus = groupMembers.map(memberId => ({
      userId: memberId,
      read: memberId.toString() === req.user.id, // 发送者默认已读
      readAt: memberId.toString() === req.user.id ? new Date() : undefined
    }));
    
    const message = new Message({
      sender: req.user.id,
      group: req.params.groupId,
      content: escapeHtml(content),
      replyTo: replyTo,
      readStatus: readStatus
    });

    await message.save();

    // Populate sender info and replyTo info
    const populatedMessage = await Message.findById(message.id)
      .populate('sender', 'username')
      .populate('replyTo', 'sender content fileName')
      .populate('replyTo.sender', 'username');

    // Send message to all members in the group via WebSocket
    getIO().to(req.params.groupId).emit('message', populatedMessage);

    res.json(populatedMessage);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route    POST api/messages/:groupId/upload
// @desc     Upload a file and send as a message
// @access   Private
router.post('/:groupId/upload', auth, upload.single('file'), async (req, res) => {
  try {
    const group = await Group.findById(req.params.groupId);
    if (!group) {
      // If group doesn't exist, delete the uploaded file
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(404).json({ msg: '群组不存在' });
    }

    // Check if user is a member
    if (!group.members.some(member => member.toString() === req.user.id)) {
      // If user is not a member, delete the uploaded file
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(403).json({ msg: '没有权限' });
    }

    if (!req.file) {
      return res.status(400).json({ msg: '请选择要上传的文件' });
    }

    // Generate file URL
    const fileUrl = `/uploads/${req.file.filename}`;
    
    // Create message with file information
    // 处理文件名编码，确保中文文件名正确显示
    let originalName = req.file.originalname;
    try {
      // 尝试解码文件名，处理可能的编码问题
      // 检查是否已经是UTF-8编码
      if (originalName.includes('%')) {
        // 如果包含%，可能是URL编码的，尝试解码
        originalName = decodeURIComponent(originalName);
      }
    } catch (err) {
      // 如果解码失败，使用原始文件名
      console.error('Error decoding filename:', err.message);
    }
    
    // 确保文件名是UTF-8编码
    originalName = Buffer.from(originalName, 'binary').toString('utf8');
    
    // 初始化每个成员的阅读状态
    const readStatus = group.members.map(memberId => ({
      userId: memberId,
      read: memberId.toString() === req.user.id, // 发送者默认已读
      readAt: memberId.toString() === req.user.id ? new Date() : undefined
    }));
    
    const message = new Message({
      sender: req.user.id,
      group: req.params.groupId,
      content: `[文件] ${originalName}`,
      fileUrl: fileUrl,
      fileName: originalName,
      fileSize: req.file.size,
      fileType: req.file.mimetype,
      readStatus: readStatus
    });

    await message.save();

    // Populate sender info
    const populatedMessage = await Message.findById(message.id).populate('sender', 'username');

    // Send message to all members in the group via WebSocket
    getIO().to(req.params.groupId).emit('message', populatedMessage);

    res.json(populatedMessage);
  } catch (err) {
    console.error(err.message);
    // If error occurs, delete the uploaded file
    if (req.file) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkErr) {
        console.error('Error deleting file:', unlinkErr.message);
      }
    }
    res.status(500).send('Server Error');
  }
});

// @route    POST api/messages/:groupId/uploads
// @desc     Upload multiple files and send as messages
// @access   Private
router.post('/:groupId/uploads', auth, upload.array('files'), async (req, res) => {
  try {
    const group = await Group.findById(req.params.groupId);
    if (!group) {
      // If group doesn't exist, delete the uploaded files
      if (req.files) {
        req.files.forEach(file => {
          try {
            fs.unlinkSync(file.path);
          } catch (unlinkErr) {
            console.error('Error deleting file:', unlinkErr.message);
          }
        });
      }
      return res.status(404).json({ msg: '群组不存在' });
    }

    // Check if user is a member
    if (!group.members.some(member => member.toString() === req.user.id)) {
      // If user is not a member, delete the uploaded files
      if (req.files) {
        req.files.forEach(file => {
          try {
            fs.unlinkSync(file.path);
          } catch (unlinkErr) {
            console.error('Error deleting file:', unlinkErr.message);
          }
        });
      }
      return res.status(403).json({ msg: '没有权限' });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ msg: '请选择要上传的文件' });
    }

    const messages = [];

    // Process each file
    for (const file of req.files) {
      // Generate file URL
      const fileUrl = `/uploads/${file.filename}`;
      
      // 处理文件名编码，确保中文文件名正确显示
      let originalName = file.originalname;
      try {
        // 尝试解码文件名，处理可能的编码问题
        // 检查是否已经是UTF-8编码
        if (originalName.includes('%')) {
          // 如果包含%，可能是URL编码的，尝试解码
          originalName = decodeURIComponent(originalName);
        }
      } catch (err) {
        // 如果解码失败，使用原始文件名
        console.error('Error decoding filename:', err.message);
      }
      
      // 确保文件名是UTF-8编码
      originalName = Buffer.from(originalName, 'binary').toString('utf8');
      
      // 初始化每个成员的阅读状态
    const readStatus = group.members.map(memberId => ({
      userId: memberId,
      read: memberId.toString() === req.user.id, // 发送者默认已读
      readAt: memberId.toString() === req.user.id ? new Date() : undefined
    }));
    
    // Create message with file information
    const message = new Message({
      sender: req.user.id,
      group: req.params.groupId,
      content: `[文件] ${originalName}`,
      fileUrl: fileUrl,
      fileName: originalName,
      fileSize: file.size,
      fileType: file.mimetype,
      readStatus: readStatus
    });

      await message.save();

      // Populate sender info
      const populatedMessage = await Message.findById(message.id).populate('sender', 'username');
      messages.push(populatedMessage);

      // Send message to all members in the group via WebSocket
      getIO().to(req.params.groupId).emit('message', populatedMessage);
    }

    res.json(messages);
  } catch (err) {
    console.error(err.message);
    // If error occurs, delete the uploaded files
    if (req.files) {
      req.files.forEach(file => {
        try {
          fs.unlinkSync(file.path);
        } catch (unlinkErr) {
          console.error('Error deleting file:', unlinkErr.message);
        }
      });
    }
    res.status(500).send('Server Error');
  }
});

// @route    DELETE api/messages/:id
// @desc     Delete a message
// @access   Private (owner, admin, or message sender)
router.delete('/:id', auth, async (req, res) => {
  try {
    const message = await Message.findById(req.params.id).populate('group');
    if (!message) {
      return res.status(404).json({ msg: '消息不存在' });
    }

    const group = message.group;

    // Check if user is owner, admin, or message sender
    const isOwner = group.owner.toString() === req.user.id;
    const isAdmin = group.admins.some(admin => admin.toString() === req.user.id);
    const isSender = message.sender.toString() === req.user.id;

    if (!isOwner && !isAdmin && !isSender) {
      return res.status(403).json({ msg: 'Not authorized' });
    }

    await Message.findByIdAndDelete(req.params.id);
    
    // Notify all members in the group that message was deleted
    getIO().to(group._id.toString()).emit('messageDeleted', req.params.id);
    
    res.json({ msg: '消息已删除' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route    PUT api/messages/:id/read
// @desc     Mark a message as read
// @access   Private
router.put('/:id/read', auth, async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);
    if (!message) {
      return res.status(404).json({ msg: '消息不存在' });
    }

    // Check if user is a member of the group
    const group = await Group.findById(message.group);
    if (!group || !group.members.some(member => member.toString() === req.user.id)) {
      return res.status(403).json({ msg: '没有权限' });
    }

    // Update read status for the user
    const updatedMessage = await Message.findOneAndUpdate(
      { 
        _id: req.params.id,
        'readStatus.userId': req.user.id
      },
      { 
        $set: {
          'readStatus.$.read': true,
          'readStatus.$.readAt': new Date()
        }
      },
      { new: true }
    );

    res.json(updatedMessage);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route    PUT api/messages/:groupId/read-all
// @desc     Mark all messages in a group as read
// @access   Private
router.put('/:groupId/read-all', auth, async (req, res) => {
  try {
    const group = await Group.findById(req.params.groupId);
    if (!group) {
      return res.status(404).json({ msg: '群组不存在' });
    }

    // Check if user is a member
    if (!group.members.some(member => member.toString() === req.user.id)) {
      return res.status(403).json({ msg: '没有权限' });
    }

    // Update all messages in the group to read for this user
    await Message.updateMany(
      { 
        group: req.params.groupId,
        'readStatus.userId': req.user.id
      },
      { 
        $set: {
          'readStatus.$.read': true,
          'readStatus.$.readAt': new Date()
        }
      }
    );

    res.json({ msg: '所有消息已标记为已读' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route    GET api/messages/:groupId/search
// @desc     Search messages in a group
// @access   Private
router.get('/:groupId/search', auth, async (req, res) => {
  try {
    const { keyword, startDate, endDate } = req.query;
    const group = await Group.findById(req.params.groupId);
    if (!group) {
      return res.status(404).json({ msg: '群组不存在' });
    }

    // Check if user is a member
    if (!group.members.some(member => member.toString() === req.user.id)) {
      return res.status(403).json({ msg: '没有权限' });
    }

    // Build search query
    const searchQuery = {
      group: req.params.groupId
    };

    // Add keyword search if provided
    if (keyword) {
      searchQuery.content = {
        $regex: keyword,
        $options: 'i' // Case insensitive
      };
    }

    // Add date range if provided
    if (startDate || endDate) {
      searchQuery.createdAt = {};
      if (startDate) {
        searchQuery.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        searchQuery.createdAt.$lte = new Date(endDate);
      }
    }

    // Execute search
    const messages = await Message.find(searchQuery)
      .populate('sender', 'username')
      .populate('replyTo', 'sender content fileName')
      .populate('replyTo.sender', 'username')
      .sort({ createdAt: 1 });

    res.json(messages);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;