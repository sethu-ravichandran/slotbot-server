import mongoose from 'mongoose'

const meetingSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      trim: true
    },
    recruiter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Recruiter',
      required: true
    },
    candidate: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Candidate'
    },
    startTime: {
      type: Date,
      required: true
    },
    endTime: {
      type: Date,
      required: true
    },
    location: {
      type: String,
      default: 'Virtual Meeting'
    },
    videoCallLink: {
      type: String
    },
    calendarLink: {
      type: String
    },
    status: {
      type: String,
      enum: ['scheduled', 'completed', 'cancelled'],
      default: 'scheduled'
    },
    nylasEventId: {
      type: String
    },
    feedback: {
      type: String
    }
  },
  { timestamps: true }
)

const Meeting = mongoose.model('Meeting', meetingSchema)

export default Meeting
