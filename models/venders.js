const mongoose = require('mongoose');
const user = require('./user');

const venderSchema = mongoose.Schema({
  imagePublicId: {
    type: String
  },
  image: String,

  Name: {
    type: String,
    required: true
  },

  Price: {
    type: Number,
    required: true
  },

  Category: {
  type: String,
  enum: [
    'Biriyani',
    'Pizza',
    'Noodles',
    'Coffee',
    'Paratha',
    'Tea',
    'Ice Cream',
    'Puri',
    'Chole Bhature',
    'Khichdi',
    'Chinese',
    'Pure Veg',
    'North Indian',
    'Desserts',
    'Lassi',
    'Gulab Jamun',
    'South Indian'
  ],
  required: true
},

  Description: {
    type: String
  },

  vender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  reviews: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    rating: {
      type: Number,
      required: true
    },
    comment: {
      type: String,
      required: true
    }
  }],

  orders: Number
});

module.exports = mongoose.model('vender', venderSchema, 'venders');