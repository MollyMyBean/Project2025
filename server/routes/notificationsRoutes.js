// server/routes/notificationsRoutes.js
const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');

function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ status: 'error', message: 'Not authorized.' });
  }
  next();
}

// GET all notifications => /api/notifications
// server/routes/notificationsRoutes.js
router.get('/', requireAuth, async (req, res) => {
    try {
      const notifs = await Notification.find({ user: req.session.user.id })
        .sort({ createdAt: -1 })
        .limit(50)
        // 👇 add populate to get the username, profilePic, etc.
        .populate('fromUser', 'username profilePic')
        .lean();
  
      return res.status(200).json({ status: 'success', notifications: notifs });
    } catch (err) {
      console.error('GET /notifications error:', err);
      return res.status(500).json({
        status: 'error',
        message: 'Server error fetching notifications.'
      });
    }
  });
  

// PATCH => mark a notification as read
router.patch('/:notifId/mark-read', requireAuth, async (req, res) => {
  try {
    const { notifId } = req.params;
    const notif = await Notification.findOne({
      _id: notifId,
      user: req.session.user.id
    });
    if (!notif) {
      return res.status(404).json({
        status: 'error',
        message: 'Notification not found or not yours.'
      });
    }
    notif.read = true;
    await notif.save();
    return res.status(200).json({
      status: 'success',
      message: 'Notification marked as read.'
    });
  } catch (err) {
    console.error('Mark notification read error:', err);
    return res.status(500).json({
      status: 'error',
      message: 'Server error marking notification.'
    });
  }
});

module.exports = router;
