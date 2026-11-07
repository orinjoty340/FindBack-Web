
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

require('dotenv').config();

const User = require('./models/User');
const Report = require('./models/Report');
const Notification = require('./models/Notification');

const notificationRoutes = require('./routes/notificationRoutes');
const { protect } = require('./middleware/authMiddleware');

const app = express();

// MIDDLEWARE
app.use(cors());
app.use(express.json());

// JWT TOKEN
const generateToken = (id) => {
  return jwt.sign(
    { id: String(id) },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

// NOTIFICATION HELPER
const createNotification = async ({
  user,
  title,
  message,
  type,
  relatedReport = null,
}) => {
  try {
    return await Notification.create({
      user,
      title,
      message,
      type,
      relatedReport,
      isRead: false,
    });
  } catch (error) {
    console.error('Notification creation error:', error.message);
    return null;
  }
};

// HOME
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'FindBack API server is running!',
  });
});

// HEALTH CHECK
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    server: 'running',
    database:
      mongoose.connection.readyState === 1
        ? 'connected'
        : 'not connected',
  });
});

// ==============================
// AUTH ROUTES
// ==============================

// SIGNUP
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (
      typeof name !== 'string' ||
      typeof email !== 'string' ||
      typeof password !== 'string' ||
      !name.trim() ||
      !email.trim() ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message: 'Name, email and password are required',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters',
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (await User.findOne({ email: normalizedEmail })) {
      return res.status(409).json({
        success: false,
        message: 'Email already registered',
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
    });

    const token = generateToken(user._id);

    return res.status(201).json({
      success: true,
      message: 'Signup successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error('Signup error:', error.message);

    return res.status(error.code === 11000 ? 409 : 500).json({
      success: false,
      message:
        error.code === 11000
          ? 'Email already registered'
          : 'Server error during signup',
    });
  }
});

// LOGIN
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (
      typeof email !== 'string' ||
      typeof password !== 'string' ||
      !email.trim() ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required',
      });
    }

    const user = await User.findOne({
      email: email.trim().toLowerCase(),
    });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    const token = generateToken(user._id);

    return res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error('Login error:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Server error during login',
    });
  }
});

// CURRENT USER
app.get('/api/auth/me', protect, (req, res) => {
  res.json({
    success: true,
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
    },
  });
});

// ==============================
// USER ROUTES
// ==============================

// READ ALL USERS
app.get('/api/users', protect, async (req, res) => {
  try {
    const users = await User.find().select('-password');

    res.json({
      success: true,
      count: users.length,
      users,
    });
  } catch (error) {
    console.error('Read users error:', error.message);

    res.status(500).json({
      success: false,
      message: 'Could not fetch users',
    });
  }
});

// READ ONE USER
app.get('/api/users/:id', protect, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID',
      });
    }

    const user = await User.findById(req.params.id).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.json({ success: true, user });
  } catch (error) {
    console.error('Read user error:', error.message);

    res.status(500).json({
      success: false,
      message: 'Could not fetch user',
    });
  }
});

// UPDATE USER
app.put('/api/users/:id', protect, async (req, res) => {
  try {
    if (String(req.user._id) !== String(req.params.id)) {
      return res.status(403).json({
        success: false,
        message: 'You can only update your own account',
      });
    }

    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID',
      });
    }

    const updates = {};

    if (req.body.name !== undefined) {
      if (
        typeof req.body.name !== 'string' ||
        !req.body.name.trim()
      ) {
        return res.status(400).json({
          success: false,
          message: 'Name cannot be empty',
        });
      }

      updates.name = req.body.name.trim();
    }

    if (req.body.email !== undefined) {
      if (
        typeof req.body.email !== 'string' ||
        !req.body.email.trim()
      ) {
        return res.status(400).json({
          success: false,
          message: 'Valid email is required',
        });
      }

      updates.email = req.body.email.trim().toLowerCase();
    }

    if (!Object.keys(updates).length) {
      return res.status(400).json({
        success: false,
        message: 'Provide a name or email to update',
      });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.json({
      success: true,
      message: 'User updated successfully',
      user,
    });
  } catch (error) {
    console.error('Update user error:', error.message);

    res.status(error.code === 11000 ? 409 : 500).json({
      success: false,
      message:
        error.code === 11000
          ? 'Email already registered'
          : 'Could not update user',
    });
  }
});

// DELETE USER
app.delete('/api/users/:id', protect, async (req, res) => {
  try {
    if (String(req.user._id) !== String(req.params.id)) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own account',
      });
    }

    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID',
      });
    }

    const user = await User.findByIdAndDelete(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (error) {
    console.error('Delete user error:', error.message);

    res.status(500).json({
      success: false,
      message: 'Could not delete user',
    });
  }
});

// ==============================
// REPORT ROUTES
// ==============================

// CREATE REPORT
app.post('/api/reports', protect, async (req, res) => {
  try {
    const {
      type,
      itemName,
      category,
      description,
      location,
      date,
    } = req.body;

    if (
      !['Lost', 'Found'].includes(type) ||
      typeof itemName !== 'string' ||
      !itemName.trim() ||
      typeof category !== 'string' ||
      !category.trim() ||
      typeof description !== 'string' ||
      !description.trim() ||
      typeof location !== 'string' ||
      !location.trim() ||
      typeof date !== 'string' ||
      !date.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: 'Please provide valid report details',
      });
    }

    const report = await Report.create({
      type,
      itemName: itemName.trim(),
      category: category.trim(),
      description: description.trim(),
      location: location.trim(),
      date: date.trim(),
      user: req.user._id,
      status: 'Active',
    });

    // Notify all users except the report creator
    try {
      const users = await User.find({
        _id: { $ne: req.user._id },
      }).select('_id');

      if (users.length > 0) {
        await Notification.insertMany(
          users.map((user) => ({
            user: user._id,
            title: `New ${type} Report`,
            message: `A new ${type.toLowerCase()} report has been posted: ${report.itemName}`,
            type: 'Report',
            relatedReport: report._id,
            isRead: false,
          }))
        );
      }
    } catch (notificationError) {
      console.error(
        'New report notification error:',
        notificationError.message
      );
    }

    return res.status(201).json({
      success: true,
      message: 'Report created successfully',
      report,
    });
  } catch (error) {
    console.error('Create report error:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Could not create report',
    });
  }
});

// READ ALL PUBLIC REPORTS WITH FILTERS
app.get('/api/reports', async (req, res) => {
  try {
    const { type, category, search } = req.query;
    const filter = {};

    if (type) {
      if (!['Lost', 'Found'].includes(type)) {
        return res.status(400).json({
          success: false,
          message: 'Type must be Lost or Found',
        });
      }

      filter.type = type;
    }

    if (category && category !== 'All') {
      const escapedCategory = String(category).replace(
        /[.*+?^${}()|[\]\\]/g,
        '\\$&'
      );

      filter.category = new RegExp(
        `^${escapedCategory}$`,
        'i'
      );
    }

    if (search && String(search).trim()) {
      const escaped = String(search)
        .trim()
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      filter.$or = [
        { itemName: new RegExp(escaped, 'i') },
        { description: new RegExp(escaped, 'i') },
        { location: new RegExp(escaped, 'i') },
      ];
    }

    const reports = await Report.find(filter)
      .populate('user', 'name')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: reports.length,
      reports,
    });
  } catch (error) {
    console.error('Read reports error:', error.message);

    res.status(500).json({
      success: false,
      message: 'Could not fetch reports',
    });
  }
});

// READ MY REPORTS
app.get('/api/reports/user/:userId', protect, async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID',
      });
    }

    if (String(req.user._id) !== String(userId)) {
      return res.status(403).json({
        success: false,
        message: 'You can only access your own reports',
      });
    }

    const reports = await Report.find({
      user: req.user._id,
    }).sort({ createdAt: -1 });

    res.json({
      success: true,
      count: reports.length,
      reports,
    });
  } catch (error) {
    console.error('Read user reports error:', error.message);

    res.status(500).json({
      success: false,
      message: 'Could not fetch user reports',
    });
  }
});

// UPDATE REPORT
app.put('/api/reports/:id', protect, async (req, res) => {
  try {
    const { id } = req.params;

    const {
      type,
      itemName,
      category,
      description,
      location,
      date,
      status,
    } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid report ID',
      });
    }

    const updates = {};

    if (type !== undefined) {
      if (!['Lost', 'Found'].includes(type)) {
        return res.status(400).json({
          success: false,
          message: 'Type must be Lost or Found',
        });
      }

      updates.type = type;
    }

    for (const field of [
      'itemName',
      'category',
      'description',
      'location',
      'date',
    ]) {
      if (req.body[field] !== undefined) {
        if (
          typeof req.body[field] !== 'string' ||
          !req.body[field].trim()
        ) {
          return res.status(400).json({
            success: false,
            message: `${field} cannot be empty`,
          });
        }

        updates[field] = req.body[field].trim();
      }
    }

    if (status !== undefined) {
      if (!['Active', 'Resolved'].includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Status must be Active or Resolved',
        });
      }

      updates.status = status;
    }

    if (!Object.keys(updates).length) {
      return res.status(400).json({
        success: false,
        message: 'No report changes provided',
      });
    }

    // Find the original report first
    const existingReport = await Report.findOne({
      _id: id,
      user: req.user._id,
    });

    if (!existingReport) {
      return res.status(404).json({
        success: false,
        message: 'Report not found or does not belong to this user',
      });
    }

    const oldStatus = existingReport.status;

    const updatedReport = await Report.findOneAndUpdate(
      {
        _id: id,
        user: req.user._id,
      },
      { $set: updates },
      { new: true, runValidators: true }
    );

    // Notify report owner when status actually changes
    if (
      status !== undefined &&
      status !== oldStatus
    ) {
      await createNotification({
        user: existingReport.user,
        title: 'Report Status Updated',
        message: `Your report "${updatedReport.itemName}" status has been changed to ${updatedReport.status}.`,
        type: 'Status',
        relatedReport: updatedReport._id,
      });
    }

    return res.json({
      success: true,
      message: 'Report updated successfully',
      report: updatedReport,
    });
  } catch (error) {
    console.error('Update report error:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Could not update report',
    });
  }
});

// DELETE REPORT
app.delete('/api/reports/:id', protect, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid report ID',
      });
    }

    const report = await Report.findOneAndDelete({
      _id: id,
      user: req.user._id,
    });

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found or does not belong to this user',
      });
    }

    // Remove notifications connected to the deleted report
    try {
      await Notification.deleteMany({
        relatedReport: report._id,
      });
    } catch (notificationError) {
      console.error(
        'Report notification cleanup error:',
        notificationError.message
      );
    }

    res.json({
      success: true,
      message: 'Report deleted successfully',
    });
  } catch (error) {
    console.error('Delete report error:', error.message);

    res.status(500).json({
      success: false,
      message: 'Could not delete report',
    });
  }
});

// ==============================
// NOTIFICATION ROUTES
// ==============================

// All notification endpoints are protected inside notificationRoutes
app.use('/api/notifications', notificationRoutes);

// ==============================
// UNKNOWN URL
// ==============================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: '404 Not Found',
  });
});

// ==============================
// START SERVER
// ==============================

async function startServer() {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI missing from .env');
    }

    if (
      !process.env.JWT_SECRET ||
      process.env.JWT_SECRET.length < 64
    ) {
      throw new Error('JWT_SECRET missing or too short in .env');
    }

    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
    });

    console.log('MongoDB connected successfully!');

    const PORT = process.env.PORT || 5000;

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`FindBack API running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Startup error:', error.message);
    process.exit(1);
  }
}

startServer();
