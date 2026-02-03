const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const connectDB = require('./config/db');
const authRoutes = require('./routes/auth');
const groupRoutes = require('./routes/groups');
const messageRoutes = require('./routes/messages');
const blacklistRoutes = require('./routes/blacklist');
const logRoutes = require('./routes/logs');
const { logger } = require('./middleware/logger');

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
app.use(logger); // Add logger middleware

// Serve static files from frontend directory
const frontendPath = path.resolve(__dirname, '../frontend');
console.log('Serving static files from:', frontendPath);
// Don't use index.html as default file
app.use(express.static(frontendPath, { index: false }));

// Serve uploaded files
const uploadsPath = path.resolve(__dirname, './uploads');
console.log('Serving uploaded files from:', uploadsPath);
// 配置静态文件服务，支持中文文件名
app.use('/uploads', (req, res, next) => {
  // 检查是否有 filename 查询参数
  if (req.query.filename) {
    try {
      // 解码文件名
      const fileName = decodeURIComponent(req.query.filename);
      // 设置响应头，使用前端传递的文件名
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(fileName)}"`);
    } catch (err) {
      console.error('Error decoding filename parameter:', err.message);
    }
  }
  next();
}, express.static(uploadsPath, {
  setHeaders: (res, filePath) => {
    // 如果没有设置响应头，则使用默认文件名
    if (!res.getHeader('Content-Disposition')) {
      // 获取文件名
      const fileName = path.basename(filePath);
      // 设置响应头，确保中文文件名正确显示
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(fileName)}"`);
    }
  }
}));

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
app.use('/api/announcements', require('./routes/announcements'));
app.use('/api/messages', messageRoutes);
app.use('/api/blacklist', blacklistRoutes);
app.use('/api/logs', logRoutes);
app.use('/api/permissions', require('./routes/permissions'));

// 404 handler
app.use((req, res) => {
  console.log('404 - Not Found:', req.url);
  res.status(404).send(`<h1>404 - Not Found</h1><p>The requested URL ${req.url} was not found on this server.</p>`);
});

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// Initialize socket.io
const { initSocket } = require('./config/socket');
initSocket(server);