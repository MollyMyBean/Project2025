const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const Video = require('../models/Video');
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

function requireAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(403).json({
      status: 'error',
      message: 'Forbidden - must be admin.'
    });
  }
  next();
}

// Setup Multer => /public/uploads
const uploadDir = path.join(__dirname, '..', 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + file.originalname;
    cb(null, uniqueName);
  }
});
const upload = multer({ storage });

/**
 * 1) ADMIN upload => main feed
 */
router.post(
  '/upload-file',
  requireAuth,
  requireAdmin,
  upload.single('mediaFile'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          status: 'error',
          message: 'No file uploaded.'
        });
      }

      // If 'title' wasn't given, default to 'Untitled'
      let { title, locked, price } = req.body;
      if (!title || !title.trim()) {
        title = 'Untitled';
      }

      // Build the file path
      const filePath = '/uploads/' + req.file.filename;

      // Auto-detect photo by extension
      const ext = path.extname(req.file.filename).toLowerCase();
      // UPDATED: Added .webp, .bmp, .edr, .fdgx
      const isImage = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.edr', '.fdgx'].includes(ext);

      // Create and save the Video doc
      const newVideo = new Video({
        title,
        videoUrl: filePath,
        isPhoto: isImage,
        locked: (locked === 'true' || locked === true),
        price: price || 0,
        uploader: req.session.user.id
      });
      await newVideo.save();

      return res.status(200).json({
        status: 'success',
        message: 'Content uploaded successfully!',
        video: newVideo
      });
    } catch (err) {
      console.error('Upload file error:', err);
      return res.status(500).json({
        status: 'error',
        message: 'Server error uploading content.'
      });
    }
  }
);

/**
 * 2) admin1 => push a file to all feeds
 */
router.post(
  '/push-all',
  requireAuth,
  requireAdmin,
  upload.single('mediaFile'),
  async (req, res) => {
    try {
      if (
        !req.session.user.email ||
        req.session.user.email.toLowerCase() !== 'admin1@example.com'
      ) {
        return res.status(403).json({
          status: 'error',
          message: 'Only admin1@example.com can push to everyone’s feed.'
        });
      }
      if (!req.file) {
        return res.status(400).json({
          status: 'error',
          message: 'No file uploaded.'
        });
      }

      let { title } = req.body;
      if (!title || !title.trim()) {
        title = 'Untitled';
      }
      const filePath = '/uploads/' + req.file.filename;

      // Detect if it’s a photo
      const ext = path.extname(req.file.filename).toLowerCase();
      // UPDATED: same set of extensions here
      const isImage = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.edr', '.fdgx'].includes(ext);

      const newVideo = new Video({
        title,
        videoUrl: filePath,
        isPhoto: isImage,
        locked: false,
        price: 0,
        uploader: req.session.user.id
      });
      await newVideo.save();

      return res.status(200).json({
        status: 'success',
        message: 'Pushed to everyone’s feed!',
        video: newVideo
      });
    } catch (err) {
      console.error('Push-all error:', err);
      return res.status(500).json({
        status: 'error',
        message: 'Server error pushing content to feed.'
      });
    }
  }
);

/**
 * 3) GET /api/videos/all => returns ALL videos (Admin only)
 */
router.get('/all', requireAuth, requireAdmin, async (req, res) => {
  try {
    const allVideos = await Video.find({})
      .populate('uploader', 'username role profilePic')
      .sort({ createdAt: -1 })
      .lean();

    const final = allVideos.map((v) => ({
      ...v,
      uploaderData: v.uploader ? [v.uploader] : []
    }));

    return res.status(200).json({
      status: 'success',
      videos: final
    });
  } catch (err) {
    console.error('GET /all videos error:', err);
    return res.status(500).json({
      status: 'error',
      message: 'Server error fetching all videos.'
    });
  }
});

/**
 * 4) GET feed => ONLY returns videos uploaded by admins
 */
router.get('/feed', requireAuth, async (req, res) => {
  try {
    // Load all videos & populate the uploader
    const allVideos = await Video.find({})
      .populate('uploader', 'username role profilePic')
      .sort({ createdAt: -1 })
      .lean();

    // Filter out any videos whose uploader is NOT an admin
    const adminOnly = allVideos.filter((v) => {
      return v.uploader && v.uploader.role === 'admin';
    });

    // Then map for final shape
    const final = adminOnly.map((v) => ({
      ...v,
      uploaderData: v.uploader ? [v.uploader] : []
    }));

    return res.status(200).json({
      status: 'success',
      videos: final
    });
  } catch (err) {
    console.error('Fetch feed error:', err);
    return res.status(500).json({
      status: 'error',
      message: 'Server error fetching feed.'
    });
  }
});

/**
 * 5) GET single video => /api/videos/single/:videoId
 */
router.get('/single/:videoId', requireAuth, async (req, res) => {
  try {
    const { videoId } = req.params;
    const video = await Video.findById(videoId)
      .populate('comments.user', 'username profilePic role')
      .lean();

    if (!video) {
      return res.status(404).json({
        status: 'error',
        message: 'Video not found.'
      });
    }
    const userObj = await User.findById(video.uploader).lean();
    const uploaderData = userObj ? [userObj] : [];

    return res.status(200).json({
      status: 'success',
      ...video,
      uploaderData
    });
  } catch (err) {
    console.error('Get single video error:', err);
    return res.status(500).json({
      status: 'error',
      message: 'Server error fetching this video.'
    });
  }
});

/**
 * 6) POST comment => add top-level comment
 */
router.post('/:videoId/comment', requireAuth, async (req, res) => {
  try {
    const { videoId } = req.params;
    const { content } = req.body;
    if (!content) {
      return res.status(400).json({
        status: 'error',
        message: 'No comment content.'
      });
    }
    const video = await Video.findById(videoId);
    if (!video) {
      return res.status(404).json({
        status: 'error',
        message: 'Video not found.'
      });
    }

    video.comments.push({
      user: req.session.user.id,
      content,
      createdAt: new Date(),
      replies: []
    });
    await video.save();

    // CREATE NOTIFICATION => if not your own video
    if (req.session.user.id !== String(video.uploader)) {
      const textMsg = `${req.session.user.username} commented on your video "${video.title}"`;
      await Notification.create({
        user: video.uploader,
        type: 'comment',
        text: textMsg,
        fromUser: req.session.user.id,
        video: video._id
      });
      if (io) {
        io.to(video.uploader.toString()).emit('new-notification', {
          type: 'comment',
          text: textMsg
        });
      }
    }

    return res.status(200).json({
      status: 'success',
      message: 'Comment added successfully.'
    });
  } catch (err) {
    console.error('Comment error:', err);
    return res.status(500).json({
      status: 'error',
      message: 'Server error adding comment.'
    });
  }
});

/**
 * 7) POST reply => reply to an existing comment
 */
router.post('/:videoId/comment/:parentId/reply', requireAuth, async (req, res) => {
  try {
    const { videoId, parentId } = req.params;
    const { content } = req.body;
    if (!content) {
      return res.status(400).json({
        status: 'error',
        message: 'No reply content.'
      });
    }
    const video = await Video.findById(videoId);
    if (!video) {
      return res.status(404).json({
        status: 'error',
        message: 'Video not found.'
      });
    }
    const comment = video.comments.id(parentId);
    if (!comment) {
      return res.status(404).json({
        status: 'error',
        message: 'Parent comment not found.'
      });
    }
    comment.replies.push({
      user: req.session.user.id,
      content,
      createdAt: new Date()
    });
    await video.save();

    // Optional notification => might go to original commenter or video uploader
    if (String(comment.user) !== req.session.user.id) {
      const textMsg = `${req.session.user.username} replied to your comment`;
      await Notification.create({
        user: comment.user,
        type: 'comment',
        text: textMsg,
        fromUser: req.session.user.id,
        video: video._id
      });
      if (io) {
        io.to(comment.user.toString()).emit('new-notification', {
          type: 'comment',
          text: textMsg
        });
      }
    }

    return res.status(200).json({
      status: 'success',
      message: 'Reply added successfully.'
    });
  } catch (err) {
    console.error('Reply error:', err);
    return res.status(500).json({
      status: 'error',
      message: 'Server error adding reply.'
    });
  }
});

/**
 * 8) POST like => toggles like on the entire video
 */
router.post('/:videoId/like', requireAuth, async (req, res) => {
  try {
    const { videoId } = req.params;
    const userId = req.session.user.id;
    const video = await Video.findById(videoId);
    if (!video) {
      return res.status(404).json({
        status: 'error',
        message: 'Video not found.'
      });
    }

    const alreadyLiked = video.likes.some((uid) => uid.toString() === userId);
    let isLiked = false;
    if (alreadyLiked) {
      video.likes = video.likes.filter((uid) => uid.toString() !== userId);
    } else {
      video.likes.push(userId);
      isLiked = true;

      // NOTIFY the video owner if not your own
      if (userId !== String(video.uploader)) {
        const textMsg = `${req.session.user.username} liked your video "${video.title}"`;
        await Notification.create({
          user: video.uploader,
          type: 'like',
          text: textMsg,
          fromUser: userId,
          video: video._id
        });
        if (io) {
          io.to(video.uploader.toString()).emit('new-notification', {
            type: 'like',
            text: textMsg
          });
        }
      }
    }
    await video.save();

    return res.status(200).json({
      status: 'success',
      message: 'Like toggled successfully.',
      isLiked
    });
  } catch (err) {
    console.error('Like error:', err);
    return res.status(500).json({
      status: 'error',
      message: 'Server error liking this video.'
    });
  }
});

/**
 * 9) POST /:videoId/comment/:commentId/like => toggles like on one comment
 */
router.post('/:videoId/comment/:commentId/like', requireAuth, async (req, res) => {
  try {
    const { videoId, commentId } = req.params;
    const userId = req.session.user.id;

    const video = await Video.findById(videoId);
    if (!video) {
      return res.status(404).json({
        status: 'error',
        message: 'Video not found.'
      });
    }
    const comment = video.comments.id(commentId);
    if (!comment) {
      return res.status(404).json({
        status: 'error',
        message: 'Comment not found.'
      });
    }

    if (!comment.likes) {
      comment.likes = [];
    }
    const alreadyLiked = comment.likes.some((uid) => uid.toString() === userId);
    let isLiked = false;
    if (alreadyLiked) {
      comment.likes = comment.likes.filter((uid) => uid.toString() !== userId);
    } else {
      comment.likes.push(userId);
      isLiked = true;

      // Possibly notify the comment’s author
      if (String(comment.user) !== userId) {
        const textMsg = `${req.session.user.username} liked your comment`;
        await Notification.create({
          user: comment.user,
          type: 'like',
          text: textMsg,
          fromUser: userId,
          video: video._id
        });
        if (io) {
          io.to(comment.user.toString()).emit('new-notification', {
            type: 'like',
            text: textMsg
          });
        }
      }
    }
    await video.save();

    return res.status(200).json({
      status: 'success',
      isLiked,
      message: isLiked ? 'Comment liked' : 'Comment unliked'
    });
  } catch (err) {
    console.error('Comment-like error:', err);
    return res.status(500).json({
      status: 'error',
      message: 'Server error liking comment.'
    });
  }
});

/**
 * 10) Admin => delete all comments by a user
 */
router.post('/delete-user-comments', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({
        status: 'error',
        message: 'No userId provided.'
      });
    }
    const allVideos = await Video.find({});
    for (const vid of allVideos) {
      // remove top-level comments by that user
      const updated = vid.comments.filter((c) => c.user.toString() !== userId);
      // also remove any replies by that user
      for (const c of updated) {
        c.replies = c.replies.filter((r) => r.user.toString() !== userId);
      }
      vid.comments = updated;
      await vid.save();
    }
    return res.status(200).json({
      status: 'success',
      message: 'All comments by user removed.'
    });
  } catch (err) {
    console.error('delete-user-comments error:', err);
    return res.status(500).json({
      status: 'error',
      message: 'Server error deleting comments.'
    });
  }
});

module.exports = { router, setIO };
