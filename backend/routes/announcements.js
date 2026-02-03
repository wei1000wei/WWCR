const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const Group = require('../models/Group');
const Announcement = require('../models/Announcement');
const GroupRequest = require('../models/GroupRequest');

// @route    GET api/announcements
// @desc     Get all announcements for current user
// @access   Private
router.get('/', auth, async (req, res) => {
  try {
    // Get all announcements for current user
    const announcements = await Announcement.find({
      recipients: req.user.id,
      status: { $in: ['unread', 'read'] }
    })
    .populate('sender', 'username')
    .populate('group', 'name')
    .sort({ createdAt: -1 });

    res.json(announcements);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route    POST api/announcements
// @desc     Create a system announcement (for owner only)
// @access   Private (owner only)
router.post('/', auth, async (req, res) => {
  const { content } = req.body;

  try {
    // Check if user is owner
    const currentUser = await User.findById(req.user.id);
    if (currentUser.role !== 'owner') {
      return res.status(403).json({ msg: '只有站主可以发布系统公告' });
    }

    // Get all users
    const users = await User.find();
    const userIds = users.map(user => user._id);

    // Create announcement
    const announcement = new Announcement({
      type: 'announcement',
      content,
      sender: req.user.id,
      recipients: userIds,
      status: 'unread'
    });

    await announcement.save();
    res.json({ msg: '系统公告发布成功', announcement });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route    POST api/announcements/invitations
// @desc     Create a group invitation
// @access   Private
router.post('/invitations', auth, async (req, res) => {
  const { groupId, recipientId } = req.body;

  try {
    // Check if group exists
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ msg: '群组不存在' });
    }

    // Check if current user is a member of the group
    if (!group.members.some(member => member.toString() === req.user.id)) {
      return res.status(403).json({ msg: '您不是该群组的成员' });
    }

    // Check if recipient exists
    const recipient = await User.findById(recipientId);
    if (!recipient) {
      return res.status(404).json({ msg: '用户不存在' });
    }

    // Check if recipient is already a member
    if (group.members.some(member => member.toString() === recipientId)) {
      return res.status(400).json({ msg: '该用户已经是群组的成员' });
    }

    // Create invitation announcement
    const announcement = new Announcement({
      type: 'invitation',
      content: `${group.name} 群组邀请您加入`,
      sender: req.user.id,
      recipients: [recipientId],
      status: 'unread',
      group: groupId,
      groupName: group.name,
      invitationStatus: 'pending'
    });

    await announcement.save();
    res.json({ msg: '邀请已发送', announcement });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route    POST api/announcements/:id/response
// @desc     Respond to an invitation
// @access   Private
router.post('/:id/response', auth, async (req, res) => {
  const { accept } = req.body;

  try {
    // Find the announcement
    const announcement = await Announcement.findById(req.params.id);
    if (!announcement) {
      return res.status(404).json({ msg: '公告不存在' });
    }

    // Check if the announcement is an invitation
    if (announcement.type !== 'invitation') {
      return res.status(400).json({ msg: '此公告不是邀请' });
    }

    // Check if the current user is the recipient
    if (!announcement.recipients.some(recipient => recipient.toString() === req.user.id)) {
      return res.status(403).json({ msg: '您不是此邀请的接收者' });
    }

    // Check if the invitation is already responded
    if (announcement.invitationStatus !== 'pending') {
      return res.status(400).json({ msg: '此邀请已经被处理' });
    }

    // Update invitation status
    announcement.invitationStatus = accept ? 'accepted' : 'rejected';
    announcement.status = 'responded';
    await announcement.save();

    if (accept) {
      // Create a join request for the group
      const joinRequest = new GroupRequest({
        group: announcement.group,
        user: req.user.id,
        status: 'pending'
      });

      await joinRequest.save();
      res.json({ msg: '邀请已接受，加入申请已发送，请等待群主或管理员审核' });
    } else {
      res.json({ msg: '邀请已拒绝' });
    }
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route    PUT api/announcements/:id/read
// @desc     Mark an announcement as read
// @access   Private
router.put('/:id/read', auth, async (req, res) => {
  try {
    // Find the announcement
    const announcement = await Announcement.findById(req.params.id);
    if (!announcement) {
      return res.status(404).json({ msg: '公告不存在' });
    }

    // Check if the current user is the recipient
    if (!announcement.recipients.some(recipient => recipient.toString() === req.user.id)) {
      return res.status(403).json({ msg: '您不是此公告的接收者' });
    }

    // Update announcement status
    announcement.status = 'read';
    await announcement.save();

    res.json({ msg: '公告已标记为已读' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;