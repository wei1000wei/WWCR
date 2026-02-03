const socketIO = require('socket.io');

// Create socket.io instance
let io;

function initSocket(server) {
  io = socketIO(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  // Socket.io connection
  io.on('connection', socket => {
    console.log('New socket connection');

    // Join a group room
    socket.on('joinGroup', ({ groupId }) => {
      socket.join(groupId);
      console.log(`User joined group: ${groupId}`);
    });

    // Leave a group room
    socket.on('leaveGroup', ({ groupId }) => {
      socket.leave(groupId);
      console.log(`User left group: ${groupId}`);
    });

    // Send a message
    socket.on('sendMessage', ({ groupId, message }) => {
      io.to(groupId).emit('message', message);
    });

    // Delete a message
    socket.on('deleteMessage', ({ groupId, messageId }) => {
      io.to(groupId).emit('messageDeleted', messageId);
    });

    // User joined group
    socket.on('userJoined', ({ groupId, user }) => {
      io.to(groupId).emit('userJoined', user);
    });

    // User left group
    socket.on('userLeft', ({ groupId, userId }) => {
      io.to(groupId).emit('userLeft', userId);
    });

    // User was kicked
    socket.on('userKicked', ({ groupId, userId }) => {
      io.to(groupId).emit('userKicked', userId);
    });

    // Disconnect
    socket.on('disconnect', () => {
      console.log('Socket disconnected');
    });
  });
}

// Get the io instance
function getIO() {
  if (!io) {
    throw new Error('Socket.io not initialized');
  }
  return io;
}

module.exports = {
  initSocket,
  getIO
};