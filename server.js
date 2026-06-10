const express = require('express');
const http = require('http');
const https = require('https');
const { Server } = require('socket.io');
const path = require('path');
const selfsigned = require('selfsigned');

const config = require('./src/config');
const dbService = require('./src/services/db');
const roomRouter = require('./src/routes/room');
const leaderboardRouter = require('./src/routes/leaderboard');
const adminRouter = require('./src/routes/admin');
const initSockets = require('./src/socket');

const app = express();

// Express Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Mount API routers
app.use('/api/room', roomRouter);
app.use('/api/admin', adminRouter);
app.use('/api/leaderboard', leaderboardRouter);

// Global leaderboard page
app.get('/leaderboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'leaderboard.html'));
});

// Main page routes
// Route for Mobile Controller
app.get('/join/:roomCode', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'mobile.html'));
});

// Route for Big Screen View
app.get('/screen/:roomCode', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'screen.html'));
});

// Route for Admin Panel
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Health check endpoint (vital for AWS ALB target group)
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'UP', timestamp: new Date() });
});

// Server Initialization Flow
let server;

if (config.NODE_ENV === 'production') {
  // In production (AWS ECS Fargate), SSL termination is handled by AWS Application Load Balancer
  // Node app runs on HTTP inside the container for maximum efficiency
  console.log('Running in PRODUCTION mode (HTTP server)...');
  server = http.createServer(app);
} else {
  // In development, generate dynamic self-signed SSL certificates
  // This is required to access the DeviceOrientation (accelerometer) APIs on mobile browsers locally
  console.log('Running in DEVELOPMENT mode (Self-signed HTTPS server)...');
  
  // Quick dynamic generation using selfsigned
  const attrs = [{ name: 'commonName', value: 'localhost' }];
  const options = {
    days: 30,
    keySize: 2048,
    algorithm: 'sha256'
  };
  const pems = selfsigned.generate(attrs, options);
  
  server = https.createServer({
    key: pems.private,
    cert: pems.cert
  }, app);
}

// Attach Socket.IO
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Initialize Socket event logic
initSockets(io);

// Start Database Schema check & Listen
async function bootstrap() {
  // Initialize DB tables if needed
  await dbService.initSchema();

  server.listen(config.PORT, () => {
    console.log('==================================================');
    console.log(`  CrowdPlay Server Running!`);
    console.log(`  Port: ${config.PORT}`);
    console.log(`  Mode: ${config.NODE_ENV}`);
    if (config.NODE_ENV !== 'production') {
      console.log(`  Access Admin Dashboard: https://localhost:${config.PORT}/admin`);
      console.log(`  Access Screen view:     https://localhost:${config.PORT}/screen/DEMO`);
    } else {
      console.log(`  Production HTTP Health Check at /health`);
    }
    console.log('==================================================');
  });
}

bootstrap().catch(err => {
  console.error('Failed to bootstrap CrowdPlay server:', err);
});
