const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const readline = require('readline');
const dotenv = require('dotenv');

// Load env variables
dotenv.config();

// Connect to database
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB Connected...'))
  .catch(err => console.error('MongoDB Connection Error:', err.message));

// User model
const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['user', 'admin', 'owner'],
    default: 'user'
  },
  realName: {
    type: String,
    required: true
  },
  phone: {
    type: String,
    required: true
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const User = mongoose.model('User', UserSchema);

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Function to create owner
async function createOwner() {
  try {
    // Get user input
    const username = await askQuestion('Enter owner username: ');
    const password = await askQuestion('Enter owner password: ');
    const realName = await askQuestion('Enter real name: ');
    const phone = await askQuestion('Enter phone number: ');

    // Check if username already exists
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      console.log('Username already taken. Please try again.');
      rl.close();
      return;
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create owner user
    const owner = new User({
      username,
      password: hashedPassword,
      role: 'owner',
      realName,
      phone,
      isVerified: true
    });

    // Save owner
    await owner.save();
    console.log('Owner account created successfully!');
    console.log(`Username: ${username}`);
    console.log('Role: owner');
    console.log('Verification status: verified');

    // Close connection
    mongoose.connection.close();
    rl.close();
  } catch (err) {
    console.error('Error creating owner:', err.message);
    mongoose.connection.close();
    rl.close();
  }
}

// Helper function to ask questions
function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

// Start the process
createOwner();