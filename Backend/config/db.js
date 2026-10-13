const mongoose = require('mongoose');

async function connectDB(uri = process.env.MONGODB_URI) {
  if (!uri) throw new Error('MONGODB_URI is required. Copy .env.example to .env and configure MongoDB.');
  await mongoose.connect(uri);
  return mongoose.connection;
}

module.exports = connectDB;
