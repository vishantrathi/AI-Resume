const mongoose = require('mongoose');

const connectDB = async () => {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/ai_resume_matching';
  await mongoose.connect(uri);
  console.log('MongoDB connected');
};

module.exports = connectDB;
