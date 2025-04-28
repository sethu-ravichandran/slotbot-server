import mongoose from 'mongoose'

const timeSlotSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Candidate',
      required: true
    },
    startTime: {
      type: Date,
      required: true
    },
    endTime: {
      type: Date,
      required: true
    },
    status: {
      type: String,
      enum: ['available', 'booked'],
      default: 'available'
    },
    meeting: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Meeting',
      default: null
    }
  },
  { timestamps: true }
)

const TimeSlot = mongoose.model('TimeSlot', timeSlotSchema)

export default TimeSlot
