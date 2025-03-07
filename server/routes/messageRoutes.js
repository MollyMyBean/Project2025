const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Message = require('../models/Message');
const User = require('../models/User');
const Notification = require('../models/Notification');

let io;
function setIO(socketIO) {
  io = socketIO;
}

function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ status: 'error', message: 'Not authorized.' });
  }
  next();
}

// Where uploaded chat files go
const uploadDir = path.join(__dirname, '..', 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueName = Date.now() + '-' + file.originalname;
    cb(null, uniqueName);
  }
});
const upload = multer({ storage });

// GET all messages
router.get('/', requireAuth, async (req, res) => {
  try {
    const user = req.session.user;
    if (user.role === 'admin') {
      // Admin => see all
      const allMessages = await Message.find({})
        .populate('sender', 'username email role')
        .populate('receiver', 'username email role')
        .sort({ createdAt: 1 });
      return res.status(200).json({ status: 'success', messages: allMessages });
    } else {
      // Normal user => only their messages
      const userId = user.id;
      const userMessages = await Message.find({
        $or: [{ sender: userId }, { receiver: userId }]
      })
        .populate('sender', 'username email role')
        .populate('receiver', 'username email role')
        .sort({ createdAt: 1 });
      return res.status(200).json({ status: 'success', messages: userMessages });
    }
  } catch (err) {
    console.error('Get messages error:', err);
    return res.status(500).json({
      status: 'error',
      message: 'Server error fetching messages.'
    });
  }
});

// GET admins for DMs => /dm-chats
router.get('/dm-chats', requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const userDoc = await User.findById(userId);
    if (!userDoc) {
      return res.status(404).json({ status: 'error', message: 'User not found.' });
    }

    // Just show all admins => normal user can DM them
    const admins = await User.find({ role: 'admin' })
      .select('_id username profilePic')
      .lean();

    // count unread
    const results = [];
    for (const adm of admins) {
      const unreadCount = await Message.countDocuments({
        sender: adm._id,
        receiver: userId,
        readBy: { $ne: userId }
      });
      results.push({
        _id: adm._id.toString(),
        username: adm.username,
        profilePic: adm.profilePic || '',
        unread: unreadCount
      });
    }

    return res.status(200).json({ status: 'success', data: results });
  } catch (err) {
    console.error('dm-chats error:', err);
    return res.status(500).json({
      status: 'error',
      message: 'Server error fetching DM chats.'
    });
  }
});

// POST => create a new text/media message
router.post('/', requireAuth, async (req, res) => {
  try {
    const senderId = req.session.user.id;
    const senderRole = req.session.user.role;
    const { recipientId, content, mediaUrl, mediaType } = req.body;

    if (!recipientId) {
      return res.status(400).json({
        status: 'error',
        message: 'Recipient ID is required.'
      });
    }

    // If normal user => can only message admin
    if (senderRole !== 'admin') {
      const userToMessage = await User.findById(recipientId);
      if (!userToMessage || userToMessage.role !== 'admin') {
        return res.status(400).json({
          status: 'error',
          message: 'Normal users can only message admins.'
        });
      }
    }

    const newMessage = new Message({
      sender: senderId,
      receiver: recipientId,
      content: content || '',
      mediaUrl: mediaUrl || '',
      mediaType: mediaType || 'none'
    });
    await newMessage.save();

    // CREATE NOTIFICATION
    const noteText = `New message from ${req.session.user.username}`;
    await Notification.create({
      user: recipientId,
      type: 'message',
      text: noteText,
      fromUser: senderId,
      message: newMessage._id
    });

    // BROADCAST => “new-notification”
    if (io) {
      io.to(recipientId.toString()).emit('new-notification', {
        type: 'message',
        text: noteText
      });
    }

    // Populate so front end sees the user objects
    await newMessage.populate('sender', 'username email role');
    await newMessage.populate('receiver', 'username email role');

    return res.status(201).json({
      status: 'success',
      message: 'Message sent!',
      newMessage
    });
  } catch (err) {
    console.error('Post message error:', err);
    return res.status(500).json({
      status: 'error',
      message: 'Server error sending message.'
    });
  }
});

// user likes an admin => not essential to notifications
// user likes an admin => /like-admin/:adminId
router.post('/like-admin/:adminId', requireAuth, async (req, res) => {
  try {
    const { adminId } = req.params;
    const userId = req.session.user.id;

    // Make sure the admin actually exists:
    const adminUser = await User.findById(adminId);
    if (!adminUser || adminUser.role !== 'admin') {
      return res.status(400).json({
        status: 'error',
        message: 'That user is not an admin.'
      });
    }

    // Add to user.likedAdmins
    const theUser = await User.findById(userId);
    if (!theUser.likedAdmins) {
      theUser.likedAdmins = [];
    }
    if (!theUser.likedAdmins.includes(adminId)) {
      theUser.likedAdmins.push(adminId);
      await theUser.save();
    }

    return res.status(200).json({
      status: 'success',
      message: `You liked ${adminUser.username}!`
    });
  } catch (err) {
    console.error('like-admin error:', err);
    return res.status(500).json({
      status: 'error',
      message: 'Server error liking admin.'
    });
  }
});

router.get('/dm-conversation/:adminId', requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const adminId = req.params.adminId;
    const conversation = await Message.find({
      $or: [
        { sender: userId, receiver: adminId },
        { sender: adminId, receiver: userId }
      ]
    })
      .populate('sender', 'username profilePic')
      .populate('receiver', 'username profilePic')
      .sort({ createdAt: 1 });
    return res.status(200).json({ status: 'success', conversation });
  } catch (err) {
    console.error('DM conversation fetch error:', err);
    return res.status(500).json({
      status: 'error',
      message: 'Server error fetching DM conversation.'
    });
  }
});


// handle file uploads => /api/messages/upload-file
router.post('/upload-file', requireAuth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        status: 'error',
        message: 'No file uploaded.'
      });
    }
    const filePath = '/uploads/' + req.file.filename;
    const mime = req.file.mimetype.toLowerCase();

    let type = 'none';
    if (mime.startsWith('image/')) {
      type = 'image';
    } else if (mime.startsWith('video/')) {
      type = 'video';
    }

    return res.status(200).json({
      status: 'success',
      message: 'File uploaded successfully!',
      filePath,
      mediaType: type
    });
  } catch (err) {
    console.error('Upload file error:', err);
    return res.status(500).json({
      status: 'error',
      message: 'Server error uploading file.'
    });
  }
});

// Tipping admin
router.post('/tip-admin', requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const userRole = req.session.user.role;
    if (userRole === 'admin') {
      return res.status(400).json({
        status: 'error',
        message: 'Admins cannot tip other admins.'
      });
    }
    const { adminId, amount } = req.body;
    if (!adminId || !amount) {
      return res.status(400).json({
        status: 'error',
        message: 'Must provide adminId and amount.'
      });
    }

    // Must have a paymentMethod
    const userDoc = await User.findById(userId);
    if (!userDoc || !userDoc.paymentMethod) {
      return res.status(400).json({
        status: 'error',
        message: 'No payment method found. Check your Settings.'
      });
    }

    // Admin valid?
    const adminDoc = await User.findById(adminId);
    if (!adminDoc || adminDoc.role !== 'admin') {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid adminId. Must be an admin.'
      });
    }

    const parsedAmt = parseFloat(amount);
    if (isNaN(parsedAmt) || parsedAmt <= 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid tip amount.'
      });
    }

    if (!adminDoc.tipsBalance) {
      adminDoc.tipsBalance = 0;
    }
    adminDoc.tipsBalance += parsedAmt;
    await adminDoc.save();

    return res.status(200).json({
      status: 'success',
      message: `Admin ${adminDoc.username} was tipped $${parsedAmt.toFixed(2)}!`
    });
  } catch (err) {
    console.error('tip-admin error:', err);
    return res.status(500).json({
      status: 'error',
      message: 'Server error sending tip.'
    });
  }
});

// mark messages as read
router.post('/mark-as-read', requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { fromAdminId } = req.body;
    if (!fromAdminId) {
      return res.status(400).json({ status: 'error', message: 'Missing fromAdminId.' });
    }

    await Message.updateMany(
      {
        sender: fromAdminId,
        receiver: userId,
        readBy: { $ne: userId }
      },
      { $push: { readBy: userId } }
    );

    return res.status(200).json({
      status: 'success',
      message: 'Messages marked as read.'
    });
  } catch (err) {
    console.error('mark-as-read error:', err);
    return res.status(500).json({
      status: 'error',
      message: 'Server error marking messages as read.'
    });
  }
});

// Admin can delete a message
router.delete('/:messageId', requireAuth, async (req, res) => {
  try {
    if (req.session.user.role !== 'admin') {
      return res.status(403).json({
        status: 'error',
        message: 'Forbidden - must be admin.'
      });
    }
    const { messageId } = req.params;
    const deleted = await Message.findByIdAndDelete(messageId);
    if (!deleted) {
      return res.status(404).json({
        status: 'error',
        message: 'Message not found or already deleted.'
      });
    }
    return res.status(200).json({
      status: 'success',
      message: 'Message deleted successfully.'
    });
  } catch (err) {
    console.error('Delete message error:', err);
    return res.status(500).json({
      status: 'error',
      message: 'Server error deleting message.'
    });
  }
});

module.exports = { router, setIO };
