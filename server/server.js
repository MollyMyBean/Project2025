/*******************************************************
 * server.js
 * Repl: https://WeeImpureKnowledge.comonbro123.repl.co
 *******************************************************/
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

// 1) Import your routes (same as before)
const authRoutes = require('./routes/authRoutes');
const messageRoutes = require('./routes/messageRoutes');
const videoRoutes = require('./routes/videoRoutes');
const profileRoutes = require('./routes/profileRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const masterRoutes = require('./routes/masterRoutes');
const notificationsRoutes = require('./routes/notificationsRoutes');

// Create Express + HTTP + Socket.io
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    // We explicitly allow your Replit domain:
    origin: 'https://WeeImpureKnowledge.comonbro123.repl.co',
    credentials: true
  }
});

/*******************************************************
 * 2) Connect to Mongo using process.env.MONGO_URI
 *******************************************************/
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

/*******************************************************
 * 3) Basic middleware: JSON, sessions, and CORS
 *******************************************************/
app.use(cors({
  origin: 'https://WeeImpureKnowledge.comonbro123.repl.co',
  credentials: true
}));
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'someSuperSecretKey',
  resave: false,
  saveUninitialized: false
}));

/*******************************************************
 * 4) Serve the React build folder from /client/build
 *******************************************************/
const buildPath = path.join(__dirname, 'client', 'build');
app.use(express.static(buildPath));

/*******************************************************
 * 5) Wire up Socket.io to the routes that need it
 *******************************************************/
messageRoutes.setIO(io);
videoRoutes.setIO(io);

/*******************************************************
 * 6) API endpoints => prefix /api
 *******************************************************/
app.use('/api/auth', authRoutes);
app.use('/api/messages', messageRoutes.router);
app.use('/api/videos', videoRoutes.router);
app.use('/api/profile', profileRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/master', masterRoutes);
app.use('/api/notifications', notificationsRoutes);

/*******************************************************
 * 7) Quick test route => /api/protected
 *******************************************************/
app.get('/api/protected', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ status: 'error', message: 'Not authorized.' });
  }
  return res.status(200).json({ status: 'success', user: req.session.user });
});

/*******************************************************
 * 8) Fallback: serve index.html for all other paths
 *    => allows React Router to handle them
 *******************************************************/
app.get('*', (req, res) => {
  res.sendFile(path.join(buildPath, 'index.html'));
});

/*******************************************************
 * 9) Socket.io => calls, notifications, etc.
 *******************************************************/
io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);

  socket.on('join-user', (userId) => {
    socket.join(userId);
    socket.data.userId = userId;
    console.log(`Socket ${socket.id} joined user room: ${userId}`);
  });

  // Example WebRTC signaling:
  socket.on('call-offer', (data) => {
    socket.to(data.toUserId).emit('call-offer', {
      fromUserId: socket.data.userId,
      offer: data.offer
    });
  });
  socket.on('call-answer', (data) => {
    socket.to(data.toUserId).emit('call-answer', {
      fromUserId: socket.data.userId,
      answer: data.answer
    });
  });
  socket.on('ice-candidate', (data) => {
    socket.to(data.toUserId).emit('ice-candidate', {
      fromUserId: socket.data.userId,
      candidate: data.candidate
    });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

/*******************************************************
 * 10) Start the server on process.env.PORT
 *******************************************************/
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
