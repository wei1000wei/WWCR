const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Message = require('../models/Message');
const Group = require('../models/Group');

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
  const { content } = req.body;

  try {
    const group = await Group.findById(req.params.groupId);
    if (!group) {
      return res.status(404).json({ msg: '群组不存在' });
    }

    // Check if user is a member
    if (!group.members.some(member => member.toString() === req.user.id)) {
      return res.status(403).json({ msg: '没有权限' });
    }

    const message = new Message({
      sender: req.user.id,
      group: req.params.groupId,
      content: escapeHtml(content)
    });

    await message.save();

    // Populate sender info
    const populatedMessage = await Message.findById(message.id).populate('sender', 'username');

    res.json(populatedMessage);
  } catch (err) {
    console.error(err.message);
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
    res.json({ msg: '消息已删除' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;