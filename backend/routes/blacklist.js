const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Blacklist = require('../models/Blacklist');
const Group = require('../models/Group');

// @route    POST api/blacklist/:groupId
// @desc     Add user to blacklist
// @access   Private (owner or admin)
router.post('/:groupId', auth, async (req, res) => {
  const { userId } = req.body;

  try {
    const group = await Group.findById(req.params.groupId);
    if (!group) {
      return res.status(404).json({ msg: '群组不存在' });
    }

    // Check if current user is owner or admin
    if (group.owner.toString() !== req.user.id && !group.admins.some(admin => admin.toString() === req.user.id)) {
      return res.status(403).json({ msg: '只有群主或管理员可以拉黑用户' });
    }

    // Check if user is already blacklisted
    const isBlacklisted = await Blacklist.findOne({ group: req.params.groupId, user: userId });
    if (isBlacklisted) {
      return res.status(400).json({ msg: '该用户已经被拉黑' });
    }

    // Remove user from group if they are a member
    if (group.members.some(member => member.toString() === userId)) {
      group.members = group.members.filter(member => member.toString() !== userId);
      group.admins = group.admins.filter(admin => admin.toString() !== userId);
      await group.save();
    }

    const blacklistEntry = new Blacklist({
      group: req.params.groupId,
      user: userId
    });

    await blacklistEntry.save();
    res.json(blacklistEntry);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route    DELETE api/blacklist/:groupId/:userId
// @desc     Remove user from blacklist
// @access   Private (owner or admin)
router.delete('/:groupId/:userId', auth, async (req, res) => {
  try {
    const group = await Group.findById(req.params.groupId);
    if (!group) {
      return res.status(404).json({ msg: 'Group not found' });
    }

    // Check if current user is owner or admin
    if (group.owner.toString() !== req.user.id && !group.admins.some(admin => admin.toString() === req.user.id)) {
      return res.status(403).json({ msg: '只有群主或管理员可以移除拉黑' });
    }

    // Check if user is blacklisted
    const blacklistEntry = await Blacklist.findOne({ group: req.params.groupId, user: req.params.userId });
    if (!blacklistEntry) {
      return res.status(400).json({ msg: '该用户没有被拉黑' });
    }

    await Blacklist.findByIdAndDelete(blacklistEntry.id);
    res.json({ msg: '用户已从黑名单中移除' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route    GET api/blacklist/:groupId
// @desc     Get all blacklisted users for a group
// @access   Private (owner or admin)
router.get('/:groupId', auth, async (req, res) => {
  try {
    const group = await Group.findById(req.params.groupId);
    if (!group) {
      return res.status(404).json({ msg: 'Group not found' });
    }

    // Check if current user is owner or admin
    if (group.owner.toString() !== req.user.id && !group.admins.some(admin => admin.toString() === req.user.id)) {
      return res.status(403).json({ msg: '只有群主或管理员可以查看黑名单' });
    }

    const blacklist = await Blacklist.find({ group: req.params.groupId }).populate('user', 'username');
    res.json(blacklist);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;