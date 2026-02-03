const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const Group = require('../models/Group');
const Blacklist = require('../models/Blacklist');
const Message = require('../models/Message');
const GroupRequest = require('../models/GroupRequest');

// @route    POST api/groups
// @desc     Create a group
// @access   Private
router.post('/', auth, async (req, res) => {
  const { name } = req.body;
  console.log('Group creation request received:', { name, userId: req.user.id });

  try {
    let group = await Group.findOne({ name });
    if (group) {
      console.log('Group already exists:', name);
      return res.status(400).json({ msg: '群组已存在' });
    }

    group = new Group({
      name,
      owner: req.user.id,
      admins: [req.user.id],
      members: [req.user.id]
    });

    console.log('Creating new group:', group);
    await group.save();
    console.log('Group created successfully:', group._id);
    res.json(group);
  } catch (err) {
    console.error('Error creating group:', err.message);
    console.error('Error stack:', err.stack);
    res.status(500).send('Server Error');
  }
});

// @route    GET api/groups
// @desc     Get all groups for current user or all groups for owner
// @access   Private
router.get('/', auth, async (req, res) => {
  try {
    console.log('Get groups request received for user:', req.user.id);
    
    // Get current user
    const currentUser = await User.findById(req.user.id);
    
    let groups;
    if (currentUser.role === 'owner') {
      // Owner can see all groups
      groups = await Group.find().populate('owner', 'username').populate('admins', 'username').populate('members', 'username');
      console.log('Owner found all groups:', groups.length);
    } else {
      // Regular user can only see their own groups
      groups = await Group.find({
        members: req.user.id
      }).populate('owner', 'username').populate('admins', 'username').populate('members', 'username');
      console.log('User found groups:', groups.length);
    }
    
    res.json(groups);
  } catch (err) {
    console.error('Error getting groups:', err.message);
    console.error('Error stack:', err.stack);
    res.status(500).send('Server Error');
  }
});

// @route    GET api/groups/:id
// @desc     Get group by ID
// @access   Private
router.get('/:id', auth, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id).populate('owner', 'username').populate('admins', 'username').populate('members', 'username');
    if (!group) {
      return res.status(404).json({ msg: '群组不存在' });
    }

    // Check if user is a member
    if (!group.members.some(member => member._id.toString() === req.user.id)) {
      return res.status(403).json({ msg: '没有权限' });
    }

    res.json(group);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route    POST api/groups/:id/join
// @desc     Send join request to a group
// @access   Private
router.post('/:id/join', auth, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ msg: 'Group not found' });
    }

    // Check if user is already a member
    if (group.members.some(member => member.toString() === req.user.id)) {
      return res.status(400).json({ msg: '您已经是该群组的成员' });
    }

    // Check if user is blacklisted
    const isBlacklisted = await Blacklist.findOne({ group: req.params.id, user: req.user.id });
    if (isBlacklisted) {
      return res.status(403).json({ msg: '您已被该群组拉黑' });
    }

    // Check if there is already a pending request
    const existingRequest = await GroupRequest.findOne({ group: req.params.id, user: req.user.id, status: 'pending' });
    if (existingRequest) {
      return res.status(400).json({ msg: '您已经提交过加入该群组的申请' });
    }

    // Create new join request
    const joinRequest = new GroupRequest({
      group: req.params.id,
      user: req.user.id,
      status: 'pending'
    });

    await joinRequest.save();

    res.json({ msg: '加入申请已发送，请等待批准。' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route    POST api/groups/:id/leave
// @desc     Leave a group
// @access   Private
router.post('/:id/leave', auth, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ msg: 'Group not found' });
    }

    // Check if user is a member
    if (!group.members.some(member => member.toString() === req.user.id)) {
      return res.status(400).json({ msg: '您不是该群组的成员' });
    }

    // Remove user from members
    group.members = group.members.filter(member => member.toString() !== req.user.id);

    // Remove user from admins if they are an admin
    group.admins = group.admins.filter(admin => admin.toString() !== req.user.id);

    // If owner leaves, transfer ownership to another admin or delete group
    if (group.owner.toString() === req.user.id) {
      if (group.admins.length > 0) {
        group.owner = group.admins[0];
      } else if (group.members.length > 0) {
        group.owner = group.members[0];
        group.admins.push(group.members[0]);
      } else {
        // Delete group if no members left
        await Group.findByIdAndDelete(req.params.id);
        return res.json({ msg: '群组已删除，因为没有成员' });
      }
    }

    await group.save();
    res.json(group);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route    POST api/groups/:id/admins
// @desc     Add admin to group
// @access   Private (owner only)
router.post('/:id/admins', auth, async (req, res) => {
  const { userId } = req.body;

  try {
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ msg: 'Group not found' });
    }

    // Check if current user is owner
    if (group.owner.toString() !== req.user.id) {
      return res.status(403).json({ msg: '只有群主可以添加管理员' });
    }

    // Check if user to add is a member
    if (!group.members.some(member => member.toString() === userId)) {
      return res.status(400).json({ msg: '该用户不是群组的成员' });
    }

    // Check if user is already an admin
    if (group.admins.some(admin => admin.toString() === userId)) {
      return res.status(400).json({ msg: '该用户已经是管理员' });
    }

    group.admins.push(userId);
    await group.save();
    res.json(group);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route    DELETE api/groups/:id/admins/:userId
// @desc     Remove admin from group
// @access   Private (owner only)
router.delete('/:id/admins/:userId', auth, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ msg: 'Group not found' });
    }

    // Check if current user is owner
    if (group.owner.toString() !== req.user.id) {
      return res.status(403).json({ msg: '只有群主可以移除管理员' });
    }

    // Check if user to remove is an admin
    if (!group.admins.some(admin => admin.toString() === req.params.userId)) {
      return res.status(400).json({ msg: '该用户不是管理员' });
    }

    // Remove user from admins
    group.admins = group.admins.filter(admin => admin.toString() !== req.params.userId);
    await group.save();
    res.json(group);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route    POST api/groups/:id/kick
// @desc     Kick user from group
// @access   Private (owner or admin)
router.post('/:id/kick', auth, async (req, res) => {
  const { userId } = req.body;

  try {
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ msg: 'Group not found' });
    }

    // Check if current user is owner or admin
    if (group.owner.toString() !== req.user.id && !group.admins.some(admin => admin.toString() === req.user.id)) {
      return res.status(403).json({ msg: '只有群主或管理员可以踢人' });
    }

    // Check if user to kick is a member
    if (!group.members.some(member => member.toString() === userId)) {
      return res.status(400).json({ msg: 'User is not a member of this group' });
    }

    // Remove user from members
    group.members = group.members.filter(member => member.toString() !== userId);

    // Remove user from admins if they are an admin
    group.admins = group.admins.filter(admin => admin.toString() !== userId);

    await group.save();
    res.json(group);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route    GET api/groups/:id/requests
// @desc     Get join requests for a group
// @access   Private (owner or admin)
router.get('/:id/requests', auth, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ msg: 'Group not found' });
    }

    // Check if current user is owner or admin
    if (group.owner.toString() !== req.user.id && !group.admins.some(admin => admin.toString() === req.user.id)) {
      return res.status(403).json({ msg: '只有群主或管理员可以查看加入申请' });
    }

    // Get all pending requests for this group
    const requests = await GroupRequest.find({ group: req.params.id, status: 'pending' }).populate('user', 'username realName phone');
    res.json(requests);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route    PUT api/groups/:id/requests/:requestId/approve
// @desc     Approve a join request
// @access   Private (owner or admin)
router.put('/:id/requests/:requestId/approve', auth, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ msg: 'Group not found' });
    }

    // Check if current user is owner or admin
    if (group.owner.toString() !== req.user.id && !group.admins.some(admin => admin.toString() === req.user.id)) {
      return res.status(403).json({ msg: '只有群主或管理员可以批准加入申请' });
    }

    // Find the request
    const request = await GroupRequest.findById(req.params.requestId);
    if (!request) {
      return res.status(404).json({ msg: '申请不存在' });
    }

    // Check if request belongs to this group
    if (request.group.toString() !== req.params.id) {
      return res.status(400).json({ msg: '该申请不属于此群组' });
    }

    // Check if request is already processed
    if (request.status !== 'pending') {
      return res.status(400).json({ msg: '该申请已经处理过' });
    }

    // Add user to group members
    group.members.push(request.user);
    await group.save();

    // Update request status
    request.status = 'approved';
    await request.save();

    res.json({ msg: '加入申请已批准' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route    PUT api/groups/:id/requests/:requestId/reject
// @desc     Reject a join request
// @access   Private (owner or admin)
router.put('/:id/requests/:requestId/reject', auth, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ msg: 'Group not found' });
    }

    // Check if current user is owner or admin
    if (group.owner.toString() !== req.user.id && !group.admins.some(admin => admin.toString() === req.user.id)) {
      return res.status(403).json({ msg: '只有群主或管理员可以拒绝加入申请' });
    }

    // Find the request
    const request = await GroupRequest.findById(req.params.requestId);
    if (!request) {
      return res.status(404).json({ msg: 'Request not found' });
    }

    // Check if request belongs to this group
    if (request.group.toString() !== req.params.id) {
      return res.status(400).json({ msg: 'Request does not belong to this group' });
    }

    // Check if request is already processed
    if (request.status !== 'pending') {
      return res.status(400).json({ msg: 'Request has already been processed' });
    }

    // Update request status
    request.status = 'rejected';
    await request.save();

    res.json({ msg: '加入申请已拒绝' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route    DELETE api/groups/:id
// @desc     Delete a group
// @access   Private (owner or owner)
router.delete('/:id', auth, async (req, res) => {
  try {
    // Get current user
    const currentUser = await User.findById(req.user.id);
    
    // Find group
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ msg: 'Group not found' });
    }

    // Check if current user is owner or owner
    if (group.owner.toString() !== req.user.id && currentUser.role !== 'owner') {
      return res.status(403).json({ msg: '只有群主或系统管理员可以删除群组' });
    }

    // Delete all messages for this group
    await Message.deleteMany({ group: req.params.id });
    
    // Delete all group requests for this group
    await GroupRequest.deleteMany({ group: req.params.id });
    
    // Delete all blacklist entries for this group
    await Blacklist.deleteMany({ group: req.params.id });
    
    // Delete the group itself
    await Group.findByIdAndDelete(req.params.id);
    
    res.json({ msg: '群组删除成功' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;