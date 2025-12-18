const mongoose = require('mongoose');

const userSchema = mongoose.Schema({
  profilePicture: String,
  profilePicturePublicId: {
    type: String
  },
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true,
  },
  lastName: String,
  email: {
    type: String,
    required: [true, 'Email is required'],
    trim: true,
    unique: true
  },
  location: {
    type: String,
    trim: true,
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
  },
  userType: {
    type: String,
    enum: ['guest', 'vender'],
    default: 'guest'
  },
  // ✅ NEW FIELD FOR canteen NAME
  canteenName: {
    type: String,
    trim: true,
    default: ''
  },
  favourites: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'vender'
  }],
  booked: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'vender'
  }],
  theme: {
    type: Boolean,
    default: false
  },
});

module.exports = mongoose.model('User', userSchema, 'user'); // model name, schema, collection