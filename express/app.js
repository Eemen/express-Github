const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const usersRouter = require('./routes/users');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Use the users router for routes starting with /users
app.use('/users', usersRouter);

// Define a simple route for the root URL
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to my Express app' });
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
}); 