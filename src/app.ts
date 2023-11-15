const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cors = require("cors")
const jwt = require('jsonwebtoken');

import User, { IUser } from './models/User';
import authRoutes from './routes/authRoutes';
import { Socket } from 'socket.io';

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Auction data
let highestBidderAmount: number = 100; // Initial bid amount
let highestBidderName: string = "None"

// Auction settings
const auctionDuration = 0.5 * 60 * 1000; // Auction duration in milliseconds (e.g., 1 minute)
let auctionEndTime: number;

// WebSocket connection handling
io.on('connection', (socket: Socket) => {
  const userId = socket.id; // Implement a function to generate a unique user ID
  console.log(`User ${socket.id} connected`);

  // Send initial auction data to the client
  socket.emit('initialAuctionData', { highestBidder: highestBidderAmount, highestBidderName: highestBidderName, userId });

  // Bid event handling
  socket.on('bid', async (newBid: number, token: string) => {

    // Verify the token
    const decodedToken = jwt.verify(token, 'your-secret-key');

    // Now 'decodedToken' contains the user information, including userId
    const userId = decodedToken.userId;

    // Implement your logic to fetch username from the database using userId
    // For example, assuming you have a User model:
    const user = await User.findById(userId as IUser | null).exec();

    if (!user) {
      console.error(`User not found for userId: ${userId}`);
      return;
    }

    const username = user.username;

    console.log(`User ${username} (${userId}) placed a bid: ${newBid}`);
    highestBidderName = username

    if (newBid > highestBidderAmount && Date.now() < auctionEndTime) {
      highestBidderAmount = newBid;
      // Broadcast the new bid and user information to all connected clients
      io.emit('updateBid', { highestBidder: highestBidderAmount, highestBidderName: highestBidderName, userId });
    }
  });

  // Disconnect event handling
  socket.on('disconnect', () => {
    console.log(`User ${userId} disconnected`);
  });
});

app.use(bodyParser.json());

var corsOptions = {
  origin: '*',
  optionsSuccessStatus: 200,
  methods: "GET, POST"
}
app.use(cors(corsOptions))

const PORT = process.env.PORT || 8000;

// Connect to MongoDB
mongoose.connect(`mongodb+srv://techmantejas:tech234man%40TEJAS@cluster0.2lyteuo.mongodb.net/`);

app.use('/auth', authRoutes);

// Start the server
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

// Start the auction timer
startAuctionTimer();

function startAuctionTimer() {
  auctionEndTime = Date.now() + auctionDuration;

  // Update clients with time remaining
  setInterval(() => {
    const timeRemaining = Math.max(0, auctionEndTime - Date.now());
    io.emit('updateTime', { timeRemaining });
  }, 1000);

  // End the auction when the timer expires
  setTimeout(() => {
    io.emit('auctionEnd');
  }, auctionDuration);
}