const express = require('express');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const authRoutes = require('./routes/auth');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');

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
app.use(bodyParser.json());
app.use('/api/auth', authRoutes);
app.get('/', (req, res) => {
  res.send('Welcome to the API');
});

let clients = {};

wss.on('connection', (ws) => {
  let userId = null;

  console.log( 'User connected' );

  ws.on('message', (message) => {
    console.log( 'working' );
    const data = JSON.parse(message);

    console.log( data );
    console.log('testing');

    if (data.type === 'login') {

      console.log('we are logging in' );
      userId = data.userId;
      clients[userId] = ws;
      console.log('User logged in:', userId);

    } else if (data.type === 'message') {

      console.log('we are in message');

      const { recipientId, text } = data;

      console.log( 'clients' );

      if (clients[recipientId]) {

        var hitting_message = {
          type: 'message',
          text,
          senderId: data.userId
        };

        clients[recipientId].send(JSON.stringify(hitting_message));

        console.log('hitting message');
        console.log(' Receipent id: '+ recipientId);
        console.log(hitting_message);


      }
    }
  });

  ws.on('close', () => {
    if (userId && clients[userId]) {
      delete clients[userId];
    }
    console.log('User disconnected:', userId);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
