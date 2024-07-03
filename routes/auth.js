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
      res.json({
        token: token,
        id: user.id,
        username: user.username,  // Include username in response
        email: user.email         // Include email in response
      });
    });
  } catch (error) {
    console.error('Error in login route:', error.message);
    res.status(500).send('Server error');
  }
});

// Get Users Route
router.get('/users', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, username, email FROM users');
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching users:', error.message);
    res.status(500).send('Server error');
  }
});

// Get User Details Route
router.get('/user/:id', async (req, res) => {
  const userId = req.params.id;
  try {
    const result = await pool.query('SELECT id, username, email FROM users WHERE id = $1', [userId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ msg: 'User not found' });
    }
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching user details:', error.message);
    res.status(500).send('Server error');
  }
});

// Friend Route
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

// Send Message Route
router.post('/messages/send', async (req, res) => {
  const { senderId, receiverId, content } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO messages (sender_id, receiver_id, content) VALUES ($1, $2, $3) RETURNING *',
      [senderId, receiverId, content]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error sending message:', error.message);
    res.status(500).send('Server error');
  }
});

// Get Messages Route
router.get('/messages', async (req, res) => {
  const { senderId, receiverId } = req.query;
  try {
    const result = await pool.query(
      'SELECT * FROM messages WHERE (sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1) ORDER BY timestamp',
      [senderId, receiverId]
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching messages:', error.message);
    res.status(500).send('Server error');
  }
});

// Create Group Route
router.post('/groups/create', async (req, res) => {
  const { name } = req.body;
  try {
    const result = await pool.query('INSERT INTO groups (name) VALUES ($1) RETURNING *', [name]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating group:', error.message);
    res.status(500).send('Server error');
  }
});

// Add User to Group Route
router.post('/groups/addUser', async (req, res) => {
  const { groupId, userId } = req.body;
  try {
    await pool.query('INSERT INTO group_members (group_id, user_id) VALUES ($1, $2)', [groupId, userId]);
    res.status(201).send('User added to group');
  } catch (error) {
    console.error('Error adding user to group:', error.message);
    res.status(500).send('Server error');
  }
});

// Get Groups for User Route
router.get('/groups/user/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const result = await pool.query('SELECT g.* FROM groups g JOIN group_members gm ON g.id = gm.group_id WHERE gm.user_id = $1', [userId]);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching groups for user:', error.message);
    res.status(500).send('Server error');
  }
});

// Get Messages for Group Route
router.get('/groups/:groupId/messages', async (req, res) => {
  const { groupId } = req.params;
  try {
    const result = await pool.query('SELECT * FROM group_messages WHERE group_id = $1 ORDER BY created_at ASC', [groupId]);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching messages for group:', error.message);
    res.status(500).send('Server error');
  }
});

// Send Message in Group Route
router.post('/groups/:groupId/messages', async (req, res) => {
  const { groupId } = req.params;
  const { senderId, content } = req.body;
  try {
    const result = await pool.query('INSERT INTO group_messages (group_id, sender_id, content) VALUES ($1, $2, $3) RETURNING *', [groupId, senderId, content]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error sending message in group:', error.message);
    res.status(500).send('Server error');
  }
});

module.exports = router;
