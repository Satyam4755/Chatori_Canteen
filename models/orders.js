const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
  guest: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  vender: { type: mongoose.Schema.Types.ObjectId, ref: 'vender' },
  name: String,
  phone: Number,
  address: String,
  payment: String,
  totalAmount: Number,
  expireAt: {
    type: Date,
    required: true
  }
});

// ✅ TTL index: Deletes document automatically after expireAt
OrderSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Order', OrderSchema, 'orders');