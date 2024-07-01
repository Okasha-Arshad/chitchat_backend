const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');

require('dotenv').config();


const router = express.Router();


// Signup Route
router.post('/signup', async (req, res) => {
  console.log('Signup endpoint hit');
  const { username, email, password } = req.body;
  console.log('Request body:', req.body);

  try {
    if (!username || !email || !password) {
      console.log('Missing fields');
      return res.status(400).json({ msg: 'Please enter all fields' });
    }

    // Check if user already exists
    const userExists = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userExists.rows.length > 0) {
      return res.status(400).json({ msg: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    console.log('Hashed password:', hashedPassword);

    const result = await pool.query(
      'INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING *',
      [username, email, hashedPassword]
    );

    // user: {
    //   id: user.id,
    //   username: user.username,
    //   email: user.email,
    // }

    const user = result.rows[0];
    res.status(201).json({
      msg: 'Account has been created.'
      
    });
  } catch (error) {
    console.error('Error in signup route:', error.message);
    res.status(500).send('Server error');
  }
});

// Login Route
router.post('/login', async (req, res) => {
  console.log('Login endpoint hit');
  const { email, password } = req.body;
  console.log('Request body:', req.body);

  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

    if (result.rows.length === 0) {
      return res.status(400).json({ msg: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({ msg: 'Invalid credentials' });
    }

    const payload = { user: { id: user.id } };
    jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' }, (err, token) => {
      if (err) throw err;
      res.json({ "token": token, "id": user.id });
    });
  } catch (error) {
    console.error('Error in login route:', error.message);
    res.status(500).send('Server error');
  }
});

//Friend Route
router.post('/friends/add', async (req, res) => {
  const { userId, friendId } = req.body;
  try {
    await pool.query('INSERT INTO friends (user_id, friend_id) VALUES ($1, $2)', [userId, friendId]);
    res.status(201).send('Friend added');
  } catch (error) {
    console.error('Error adding friend:', error.message);
    res.status(500).send('Server error');
  }
});


//Send Message Route
router.post('/messages/send', async (req, res) => {
  const { senderId, receiverId, content } = req.body;
  try {
    await pool.query('INSERT INTO messages (sender_id, receiver_id, content) VALUES ($1, $2, $3)', [senderId, receiverId, content]);
    res.status(201).send('Message sent');
  } catch (error) {
    console.error('Error sending message:', error.message);
    res.status(500).send('Server error');
  }
});


//Get Message Route
router.get('/messages', async (req, res) => {
  const { userId, friendId } = req.query;
  try {
    const result = await pool.query(
      'SELECT * FROM messages WHERE (sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1) ORDER BY created_at',
      [userId, friendId]
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching messages:', error.message);
    res.status(500).send('Server error');
  }
});


module.exports = router;
