const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const http = require('http');
const { initializeDatabase } = require('./config/db');
const apiRoutes = require('./routes');
const socketHandler = require('./utils/socketHandler');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

// 1. Setup global security headers
app.use(helmet());
app.use(cookieParser());

// 2. Setup CORS (Restricted to the Next.js frontend origin)
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// 3. Rate limiting to prevent brute-force attacks
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Limit each IP to 200 requests per 15 mins
  message: {
    success: false,
    message: 'Too many requests, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api', globalLimiter);

// Stricter rate limit specifically for authentication routes (login/register)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Limit each IP to 30 authentication requests per 15 mins
  message: {
    success: false,
    message: 'Too many authentication attempts. Please try again after 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/vendor/auth/login', authLimiter);
app.use('/api/vendor/auth/register', authLimiter);

// 4. Body parser middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// 5. Mount Namespaced routes
app.use('/api', apiRoutes);

// Serve uploads statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date() });
});

// 6. Global error handling middleware
app.use((err, req, res, next) => {
  console.error('[Global Error Handler]:', err.stack || err.message);
  res.status(err.status || 500).json({
    success: false,
    message: 'An unexpected server error occurred.'
  });
});

// 7. Initialize Database & Boot Server
async function startServer() {
  try {
    await initializeDatabase();
    
    // Initialize Socket.io
    socketHandler.init(server, {
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization']
    });
    
    server.listen(PORT, () => {
      console.log(`[Server] Express + Socket.IO server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('[Server] Boot failure:', error.message);
    process.exit(1);
  }
}

startServer();
