const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const authRoutes = require('./routes/auth');
const pool = require('./db'); // Ensure you have the correct path to your db module

dotenv.config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(cors({
  origin: 'http://localhost:59153',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Serve static files from the 'uploads' directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth', authRoutes);

app.get('/', (req, res) => {
  res.send('Welcome to the API');
});

let clients = {};

wss.on('connection', (ws) => {
  let userId = null;

  console.log('User connected');

  ws.on('message', (message) => {
    console.log('working');
    const data = JSON.parse(message);

    console.log(data);
    console.log('testing');

    if (data.type === 'login') {
      console.log('we are logging in');
      userId = data.userId;
      clients[userId] = ws;
      console.log('User logged in:', userId);
      broadcastStatus(userId, 'Active now');

    } else if (data.type === 'message') {
      console.log('we are in message');
      const { recipientId, text, imageUrl } = data;

      if (clients[recipientId]) {
        const hitting_message = {
          type: 'message',
          text,
          senderId: data.userId,
          imageUrl // Add imageUrl to the message payload
        };

        clients[recipientId].send(JSON.stringify(hitting_message));
        console.log('hitting message');
        console.log('Recipient id: ' + recipientId);
        console.log(hitting_message);
      }

      // Clear typing status when a message is sent
      broadcastTypingStatus(data.userId, data.recipientId, false);

    } else if (data.type === 'groupMessage') {
      console.log('we are in groupMessage');
      const { groupId, text, imageUrl } = data;

      // Broadcast to all group members
      broadcastToGroupMembers(groupId, {
        type: 'groupMessage',
        text,
        senderId: data.userId,
        imageUrl // Add imageUrl to the message payload
      });

      // Clear typing status when a message is sent
      broadcastGroupTypingStatus(data.userId, groupId, false);

    } else if (data.type === 'typing') {
      if (clients[data.recipientId]) {
        clients[data.recipientId].send(JSON.stringify({
          type: 'typing',
          userId: data.userId,
          isTyping: data.isTyping,
        }));
      }
    } else if (data.type === 'groupTyping') {
      broadcastGroupTypingStatus(data.userId, data.groupId, data.isTyping);
    }
  });

  ws.on('close', () => {
    if (userId && clients[userId]) {
      delete clients[userId];
      broadcastStatus(userId, 'offline');
    }
    console.log('User disconnected:', userId);
  });
});

function broadcastStatus(userId, status) {
  Object.values(clients).forEach((client) => {
    client.send(JSON.stringify({
      type: 'status',
      userId: userId,
      status: status,
    }));
  });
}

function broadcastTypingStatus(userId, recipientId, isTyping) {
  if (clients[recipientId]) {
    clients[recipientId].send(JSON.stringify({
      type: 'typing',
      userId: userId,
      isTyping: isTyping,
    }));
  }
}

function broadcastToGroupMembers(groupId, message) {
  // Fetch group members from the database
  pool.query('SELECT user_id FROM group_members WHERE group_id = $1', [groupId], (error, results) => {
    if (error) {
      console.error('Error fetching group members:', error.message);
      return;
    }

    results.rows.forEach(row => {
      const userId = row.user_id;
      if (clients[userId]) {
        clients[userId].send(JSON.stringify(message));
      }
    });
  });
}

function broadcastGroupTypingStatus(userId, groupId, isTyping) {
  pool.query('SELECT user_id FROM group_members WHERE group_id = $1', [groupId], (error, results) => {
    if (error) {
      console.error('Error fetching group members:', error.message);
      return;
    }

    results.rows.forEach(row => {
      const memberId = row.user_id;
      if (memberId !== userId && clients[memberId]) {
        clients[memberId].send(JSON.stringify({
          type: 'groupTyping',
          userId: userId,
          groupId: groupId,
          isTyping: isTyping,
        }));
      }
    });
  });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
