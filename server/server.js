// server.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

// Import routes
const authRoutes = require('./routes/authRoutes');
// NOTE: Import the route objects (NOT default) from messageRoutes & videoRoutes:
const messageRoutes = require('./routes/messageRoutes');
const videoRoutes = require('./routes/videoRoutes');
const profileRoutes = require('./routes/profileRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const masterRoutes = require('./routes/masterRoutes');
const notificationsRoutes = require('./routes/notificationsRoutes'); // For notifications
const twitterRoutes = require('./routes/twitter');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:3000',
    credentials: true
  }
});

// Connect Mongo
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Basic middleware
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'someSuperSecretKey',
  resave: false,
  saveUninitialized: false
}));

// Serve static => /public/uploads
app.use(express.static(path.join(__dirname, 'public')));

// Inject "io" into the routes
messageRoutes.setIO(io);
videoRoutes.setIO(io);

// Actually use those router objects
app.use('/api/auth', authRoutes);
app.use('/api/messages', messageRoutes.router);
app.use('/api/videos', videoRoutes.router);
app.use('/api/profile', profileRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/master', masterRoutes);
app.use('/api/notifications', notificationsRoutes);

app.use('/api/twitter', twitterRoutes);


// Test protected route
app.get('/api/protected', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ status: 'error', message: 'Not authorized.' });
  }
  return res.status(200).json({ status: 'success', user: req.session.user });
});

// Socket.io => calls + real-time notifications
io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);

  socket.on('join-user', (userId) => {
    socket.join(userId);
    socket.data.userId = userId;
    console.log(`Socket ${socket.id} joined user room: ${userId}`);
  });

  // Example: WebRTC events, if used
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



// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
