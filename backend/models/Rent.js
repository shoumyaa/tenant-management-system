const mongoose = require('mongoose');

const rentSchema = new mongoose.Schema({
  tenant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  month: {
    type: String, // Format: "2024-01"
    required: true
  },
  year: {
    type: Number,
    required: true
  },
  baseRent: {
    type: Number,
    required: true,
    default: 0
  },
  // Electricity
  previousUnit: {
    type: Number,
    default: 0
  },
  currentUnit: {
    type: Number,
    default: 0
  },
  unitsConsumed: {
    type: Number,
    default: 0
  },
  ratePerUnit: {
    type: Number,
    default: 10
  },
  electricityAmount: {
    type: Number,
    default: 0
  },
  totalAmount: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['Paid', 'Unpaid'],
    default: 'Unpaid'
  },
  paidDate: {
    type: Date
  },
  notes: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

// Auto calculate electricity and total before save
rentSchema.pre('save', function (next) {
  if (this.currentUnit >= this.previousUnit) {
    this.unitsConsumed = this.currentUnit - this.previousUnit;
  } else {
    this.unitsConsumed = 0;
  }
  this.electricityAmount = this.unitsConsumed * this.ratePerUnit;
  this.totalAmount = this.baseRent + this.electricityAmount;
  next();
});

// Compound index to prevent duplicate rent for same tenant/month
rentSchema.index({ tenant: 1, month: 1 }, { unique: true });

module.exports = mongoose.model('Rent', rentSchema);
