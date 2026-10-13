const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, minlength: 1, maxlength: 160 },
  description: { type: String, trim: true, maxlength: 2000, default: '' },
  priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  dueDate: { type: Date, default: null },
  completed: { type: Boolean, default: false },
  estimatedMinutes: {
    type: Number,
    min: 1,
    max: 1440,
    default: null,
    validate: { validator: (value) => value == null || Number.isInteger(value), message: 'estimatedMinutes must be an integer' }
  },
  planId: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan', default: null },
  planIndex: { type: Number, min: 0, default: null }
}, { timestamps: true });

taskSchema.index({ dueDate: 1 });
taskSchema.index({ planId: 1, planIndex: 1 }, { unique: true, partialFilterExpression: { planId: { $type: 'objectId' }, planIndex: { $type: 'number' } } });
module.exports = mongoose.models.Task || mongoose.model('Task', taskSchema);
