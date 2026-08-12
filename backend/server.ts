import express from 'express';
import dotenv from 'dotenv';
import http from 'http';
import { Server } from 'socket.io';
import v1Router from "./src/api/v1/router";
import { errorHandler } from './src/api/v1/middlewares/error.middleware';
import { initTrackingSocket } from './src/api/v1/modules/tracking/tracking.socket';

import path from 'path';

// Load environment variables from .env file
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static uploads directory for local POD photo fallback
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Api versioning 
app.use('/api/v1', v1Router);
app.use(errorHandler);


// Wrap Express app in an HTTP server for Socket.io support
const server = http.createServer(app);

// Initialize Socket.io
const io = new Server(server, {
  cors: {
    origin: "*", // Allow all origins for development/testing
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE"],
  }
});

// Bootstrap tracking WebSocket logic
initTrackingSocket(io);

// Listen using the 'server' instance (not 'app')
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
