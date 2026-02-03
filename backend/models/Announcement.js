const mongoose = require('mongoose');

const AnnouncementSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['announcement', 'invitation'],
    required: true
  },
  content: {
    type: String,
    required: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  recipients: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  status: {
    type: String,
    enum: ['unread', 'read', 'responded'],
    default: 'unread'
  },
  // Fields for invitation type
  group: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group'
  },
  groupName: {
    type: String
  },
  invitationStatus: {
    type: String,
    enum: ['pending', 'accepted', 'rejected']
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Announcement', AnnouncementSchema);