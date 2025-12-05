const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const connectDB = require('./config/db');
const authRoutes = require('./routes/auth');
const groupRoutes = require('./routes/groups');
const messageRoutes = require('./routes/messages');
const blacklistRoutes = require('./routes/blacklist');

// Load env variables
dotenv.config();

// Connect to database
connectDB().catch(err => {
  console.error('MongoDB connection failed. The app will run in demo mode.');
  console.error('Error:', err.message);
});

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from frontend directory
const frontendPath = path.resolve(__dirname, '../frontend');
console.log('Serving static files from:', frontendPath);
// Don't use index.html as default file
app.use(express.static(frontendPath, { index: false }));

// Routes
app.get('/', (req, res) => {
  console.log('Root path accessed');
  res.sendFile(path.join(frontendPath, 'home.html'));
});

// Test route to verify Express is working
app.get('/test', (req, res) => {
  res.send('Express server is working!');
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/blacklist', blacklistRoutes);

// 404 handler
app.use((req, res) => {
  console.log('404 - Not Found:', req.url);
  res.status(404).send(`<h1>404 - Not Found</h1><p>The requested URL ${req.url} was not found on this server.</p>`);
});

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// Socket.io setup
const io = require('socket.io')(server, {
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