## WWCR Web Application

我的WWCR网站！由WW(luogu:weiwei1000)开发！

### 项目简介
WWCR 是一个基于 Node.js 和 Express 开发的实时聊天应用，支持用户认证、群组管理、实时消息和黑名单功能。

### 技术栈
- **前端**：HTML5, CSS3, JavaScript
- **后端**：Node.js, Express
- **数据库**：MongoDB
- **实时通信**：Socket.io
- **认证**：JWT (JSON Web Tokens)
- **其他依赖**：bcrypt, cors, dotenv

### 功能特点
- 用户注册和登录
- 群组创建和管理
- 实时消息发送和接收
- 用户加入/离开群组
- 消息删除功能
- 黑名单管理
- 管理员功能
- 公告系统：站主可以发布系统公告给所有用户
- 邀请入群功能：群内用户可以邀请其他用户加入群组，被邀请用户可以在公告页面查看并处理邀请

### 安装和运行

1. 安装依赖：
```bash
npm install
```

2. 运行应用：
```bash
npm start
```

或者使用批处理文件：
```bash
run_app.bat
```

3. 访问应用：
```
http://localhost:3000
```

### 项目结构
```
├── backend/          # 后端代码
│   ├── app.js        # 应用入口
│   ├── config/       # 配置文件
│   ├── middleware/   # 中间件
│   ├── models/       # 数据模型
│   └── routes/       # API 路由
├── frontend/         # 前端代码
│   ├── css/          # CSS 样式
│   ├── js/           # JavaScript 文件
│   └── *.html        # HTML 页面
├── package.json      # 项目配置
└── run_app.bat       # 启动脚本
```

### AI 辅助开发
感谢 TRAE AI 提供的帮助，使我能够轻松快捷地完成这个项目！

### 注意事项
- 我在使用 GitHub 时不太顺畅，因为使用过程中会遇到一些卡顿和延迟。
- 项目支持 demo 模式，当 MongoDB 连接失败时会自动切换到该模式。
