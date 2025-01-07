// server/server.js

const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 5000; // You can change the port if you want

// Middleware
app.use(cors());
app.use(express.json());

// Basic test route
app.get('/', (req, res) => {
  res.send('Hello from Express server!');
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
