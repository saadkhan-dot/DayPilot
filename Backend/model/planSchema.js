const mongoose = require('mongoose');

const proposedTaskSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 160 },
  description: { type: String, default: '', maxlength: 1000 },
  priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  estimatedMinutes: { type: Number, required: true, min: 5, max: 480 },
  suggestedOrder: { type: Number, required: true, min: 1 },
  timeSlot: { type: String, default: '' },
  reasoning: { type: String, required: true, maxlength: 400 }
}, { _id: false });

const planSchema = new mongoose.Schema({
  request: { type: String, required: true, maxlength: 3000 },
  date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  availableMinutes: { type: Number, required: true, min: 5, max: 1440 },
  priorities: { type: String, default: '', maxlength: 1000 },
  tasks: { type: [proposedTaskSchema], required: true },
  summary: { type: String, required: true, maxlength: 1000 },
  status: { type: String, enum: ['pending', 'approved'], default: 'pending' },
  approvedAt: { type: Date, default: null }
}, { timestamps: true });

module.exports = mongoose.models.Plan || mongoose.model('Plan', planSchema);
