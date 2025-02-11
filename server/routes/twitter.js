// routes/twitter.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const Tweet = require('../models/Tweet');
const User = require('../models/User');

// Reuse your "requireAuth" middleware to ensure user is logged in
function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ status: 'error', message: 'Not authorized.' });
  }
  next();
}

// Setup a Multer instance for optional tweet media
const uploadDir = path.join(__dirname, '..', 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + file.originalname;
    cb(null, uniqueName);
  },
});
const upload = multer({ storage });

/**
 * POST /api/twitter/posts
 * Create a new tweet (with optional mediaFile).
 */
router.post('/posts', requireAuth, upload.single('mediaFile'), async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { content } = req.body;
    if (!content && !req.file) {
      // If there's truly nothing, error out
      return res
        .status(400)
        .json({ status: 'error', message: 'Tweet cannot be empty.' });
    }

    let mediaUrl = '';
    if (req.file) {
      mediaUrl = '/uploads/' + req.file.filename;
    }

    const newTweet = new Tweet({
      content: (content || '').trim(),
      author: userId,
      mediaUrl
    });
    await newTweet.save();

    return res.status(201).json({
      status: 'success',
      message: 'Tweet created successfully!',
      tweet: newTweet
    });
  } catch (err) {
    console.error('Create tweet error:', err);
    return res
      .status(500)
      .json({ status: 'error', message: 'Server error creating tweet.' });
  }
});

/**
 * GET /api/twitter/posts
 * Return all tweets sorted newest first, plus populate author & comments
 */
router.get('/posts', requireAuth, async (req, res) => {
  try {
    const tweets = await Tweet.find({})
      .populate('author', 'username profilePic')
      .populate('comments.user', 'username profilePic')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      status: 'success',
      tweets
    });
  } catch (err) {
    console.error('Get tweets error:', err);
    return res
      .status(500)
      .json({ status: 'error', message: 'Server error fetching tweets.' });
  }
});

/**
 * POST /api/twitter/:tweetId/like
 * Toggle like on a tweet
 */
router.post('/:tweetId/like', requireAuth, async (req, res) => {
  try {
    const tweetId = req.params.tweetId;
    const userId = req.session.user.id;

    const tweet = await Tweet.findById(tweetId);
    if (!tweet) {
      return res.status(404).json({ status: 'error', message: 'Tweet not found.' });
    }

    const alreadyLiked = tweet.likes.some((uid) => uid.toString() === userId);
    if (alreadyLiked) {
      tweet.likes = tweet.likes.filter((uid) => uid.toString() !== userId);
    } else {
      tweet.likes.push(userId);
    }
    await tweet.save();

    return res.status(200).json({
      status: 'success',
      isLiked: !alreadyLiked,
      tweet
    });
  } catch (err) {
    console.error('Like tweet error:', err);
    return res
      .status(500)
      .json({ status: 'error', message: 'Server error liking tweet.' });
  }
});

/**
 * POST /api/twitter/:tweetId/comment
 * Add a comment to a tweet
 */
router.post('/:tweetId/comment', requireAuth, async (req, res) => {
  try {
    const { tweetId } = req.params;
    const { content } = req.body;
    if (!content || !content.trim()) {
      return res
        .status(400)
        .json({ status: 'error', message: 'Comment cannot be empty.' });
    }

    const tweet = await Tweet.findById(tweetId);
    if (!tweet) {
      return res.status(404).json({ status: 'error', message: 'Tweet not found.' });
    }

    tweet.comments.push({
      user: req.session.user.id,
      content: content.trim()
    });
    await tweet.save();

    // Re-populate to return updated doc
    const updated = await Tweet.findById(tweetId)
      .populate('author', 'username profilePic')
      .populate('comments.user', 'username profilePic');

    return res.status(200).json({
      status: 'success',
      tweet: updated
    });
  } catch (err) {
    console.error('Comment tweet error:', err);
    return res.status(500).json({
      status: 'error',
      message: 'Server error posting comment.'
    });
  }
});

/**
 * DELETE /api/twitter/:tweetId
 * Delete a tweet if the current user is the author or an admin
 */
router.delete('/:tweetId', requireAuth, async (req, res) => {
  try {
    const tweetId = req.params.tweetId;
    const userId = req.session.user.id;

    const tweet = await Tweet.findById(tweetId);
    if (!tweet) {
      return res.status(404).json({ status: 'error', message: 'Tweet not found.' });
    }

    // Check if user is author or an admin
    const userDoc = await User.findById(userId);
    const isAdmin = (userDoc.role === 'admin');
    const isAuthor = (tweet.author.toString() === userId);

    if (!isAuthor && !isAdmin) {
      return res.status(403).json({
        status: 'error',
        message: 'You can only delete your own tweet (or be an admin).'
      });
    }

    // Ok, do the delete
    await Tweet.deleteOne({ _id: tweetId });

    return res.status(200).json({
      status: 'success',
      message: 'Tweet deleted.'
    });
  } catch (err) {
    console.error('Delete tweet error:', err);
    return res.status(500).json({
      status: 'error',
      message: 'Server error deleting tweet.'
    });
  }
});

module.exports = router;
