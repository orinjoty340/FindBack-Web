
const express = require('express');
const mongoose = require('mongoose');

const Notification = require('../models/Notification');
const User = require('../models/User');
const { protect } = require('../middleware/authMiddleware');
const { sendEmail } = require('../utils/emailService');

const router = express.Router();

// ADMIN CHECK
const requireAdmin = (req, res, next) => {
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const loggedInEmail = req.user?.email?.trim().toLowerCase();

  if (!adminEmail || !loggedInEmail || loggedInEmail !== adminEmail) {
    return res.status(403).json({
      success: false,
      message: 'Admin access required',
    });
  }

  next();
};

// SEND SPECIAL ANNOUNCEMENT
// Only the configured admin can send announcements.
router.post('/announcement', protect, requireAdmin, async (req, res) => {
  try {
    const { title, message } = req.body;

    if (
      typeof title !== 'string' ||
      typeof message !== 'string' ||
      !title.trim() ||
      !message.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: 'Title and message are required',
      });
    }

    if (title.trim().length > 150 || message.trim().length > 2000) {
      return res.status(400).json({
        success: false,
        message: 'Title or message is too long',
      });
    }

    const users = await User.find().select('_id email');

    if (users.length === 0) {
      return res.json({
        success: true,
        message: 'No users found',
        notificationCount: 0,
        emailCount: 0,
      });
    }

    // Create in-app notifications for all users
    await Notification.insertMany(
      users.map((user) => ({
        user: user._id,
        title: title.trim(),
        message: message.trim(),
        type: 'System',
        isRead: false,
      }))
    );

    // Send email only for special announcements
    const emailResults = await Promise.allSettled(
      users
        .filter((user) => user.email)
        .map((user) =>
          sendEmail({
            to: user.email,
            subject: `FindBack Announcement: ${title.trim()}`,
            text: `${title.trim()}\n\n${message.trim()}\n\n- FindBack Team`,
          })
        )
    );

    const emailCount = emailResults.filter(
      (result) => result.status === 'fulfilled' && result.value === true
    ).length;

    return res.status(201).json({
      success: true,
      message: 'Announcement created successfully',
      notificationCount: users.length,
      emailCount,
      emailFailedCount: users.filter((user) => user.email).length - emailCount,
    });
  } catch (error) {
    console.error('Announcement error:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Could not send announcement',
    });
  }
});

// GET ALL MY NOTIFICATIONS
router.get('/', protect, async (req, res) => {
  try {
    const notifications = await Notification.find({
      user: req.user._id,
    }).sort({ createdAt: -1 });

    res.json({
      success: true,
      count: notifications.length,
      notifications,
    });
  } catch (error) {
    console.error('Fetch notifications error:', error.message);

    res.status(500).json({
      success: false,
      message: 'Could not fetch notifications',
    });
  }
});

// GET UNREAD NOTIFICATION COUNT
router.get('/unread-count', protect, async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      user: req.user._id,
      isRead: false,
    });

    res.json({
      success: true,
      count,
    });
  } catch (error) {
    console.error('Unread count error:', error.message);

    res.status(500).json({
      success: false,
      message: 'Could not fetch unread count',
    });
  }
});

// MARK ALL NOTIFICATIONS AS READ
router.patch('/read-all', protect, async (req, res) => {
  try {
    const result = await Notification.updateMany(
      {
        user: req.user._id,
        isRead: false,
      },
      {
        $set: { isRead: true },
      }
    );

    res.json({
      success: true,
      message: 'All notifications marked as read',
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error('Mark all read error:', error.message);

    res.status(500).json({
      success: false,
      message: 'Could not update notifications',
    });
  }
});

// MARK ONE NOTIFICATION AS READ
router.patch('/:id/read', protect, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid notification ID',
      });
    }

    const notification = await Notification.findOneAndUpdate(
      {
        _id: id,
        user: req.user._id,
      },
      {
        $set: { isRead: true },
      },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found',
      });
    }

    res.json({
      success: true,
      message: 'Notification marked as read',
      notification,
    });
  } catch (error) {
    console.error('Mark notification read error:', error.message);

    res.status(500).json({
      success: false,
      message: 'Could not update notification',
    });
  }
});

// DELETE ONE NOTIFICATION
router.delete('/:id', protect, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid notification ID',
      });
    }

    const notification = await Notification.findOneAndDelete({
      _id: id,
      user: req.user._id,
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found',
      });
    }

    res.json({
      success: true,
      message: 'Notification deleted successfully',
    });
  } catch (error) {
    console.error('Delete notification error:', error.message);

    res.status(500).json({
      success: false,
      message: 'Could not delete notification',
    });
  }
});

module.exports = router;

