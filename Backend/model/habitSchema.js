const mongoose = require('mongoose');

const completionSchema = new mongoose.Schema({
  date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  completedAt: { type: Date, required: true, default: Date.now }
}, { _id: false });

const habitSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, minlength: 1, maxlength: 120 },
  description: { type: String, trim: true, maxlength: 1000, default: '' },
  active: { type: Boolean, default: true },
  completions: { type: [completionSchema], default: [] }
}, { timestamps: true });

module.exports = mongoose.models.Habit || mongoose.model('Habit', habitSchema);
