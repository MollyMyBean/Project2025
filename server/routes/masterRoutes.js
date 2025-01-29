// server/routes/masterRoutes.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose'); // so we can use "new mongoose.Types.ObjectId()"
const Video = require('../models/Video');
const User = require('../models/User');

// Restrict to admin1
function requireAdmin1(req, res, next) {
  if (
    !req.session.user ||
    req.session.user.role !== 'admin' ||
    req.session.user.email.toLowerCase() !== 'admin1@example.com'
  ) {
    return res.status(403).json({
      status: 'error',
      message: 'Forbidden - only admin1 can do this.'
    });
  }
  next();
}

/**
 * POST /api/master/simulate-traffic
 * Request body: { videoId, userIds: [...] }
 * 
 * This adds:
 *  - A random number (10..9999) of "fake" likes to the video
 *  - A random shareCount increment (10..99)
 *  - One new comment per userId in the array
 */
router.post('/simulate-traffic', requireAdmin1, async (req, res) => {
  try {
    const { videoId, userIds } = req.body;
    if (!videoId || !userIds || !userIds.length) {
      return res
        .status(400)
        .json({ status: 'error', message: 'Must provide videoId and userIds.' });
    }
    const videoDoc = await Video.findById(videoId);
    if (!videoDoc) {
      return res
        .status(404)
        .json({ status: 'error', message: 'Video not found.' });
    }

    // 1) Overwrite likes with a big random number (10..9999).
    //    We'll create “fake” userIDs so the likes array is that size.
    videoDoc.likes = [];
    const randomLikeCount = Math.floor(Math.random() * 9990) + 10; // => 10..9999
    for (let i = 0; i < randomLikeCount; i++) {
      videoDoc.likes.push(new mongoose.Types.ObjectId());
    }

    // 2) random shareCount => add 10..99 more shares
    if (!videoDoc.shareCount) {
      videoDoc.shareCount = 0;
    }
    const randomShares = Math.floor(Math.random() * 90) + 10; // => 10..99
    videoDoc.shareCount += randomShares;

    // 3) random comments => each userId in request gets a new comment
    const possibleComments = [
      'Beautiful!',
      'Love this!',
      'So good looking!',
      'Wow, amazing!',
      'Incredible 😍',
      'Nice job!',
      'Awesome stuff!',
      'OMG so cool!'
    ];
    if (!videoDoc.comments) {
      videoDoc.comments = [];
    }
    userIds.forEach((uid) => {
      const idx = Math.floor(Math.random() * possibleComments.length);
      const text = possibleComments[idx];
      videoDoc.comments.push({
        user: new mongoose.Types.ObjectId(uid), // references that user
        content: text,
        likes: [],
        createdAt: new Date()
      });
    });

    // Save
    await videoDoc.save();

    return res.status(200).json({
      status: 'success',
      message: `Simulated traffic: +${randomLikeCount} likes, +${randomShares} shares, plus ${userIds.length} comments added.`,
      video: videoDoc
    });
  } catch (err) {
    console.error('simulate-traffic error:', err);
    return res.status(500).json({
      status: 'error',
      message: 'Server error simulating traffic.'
    });
  }
});

module.exports = router;
