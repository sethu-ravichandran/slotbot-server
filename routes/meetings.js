import express from 'express'
import Meeting from '../models/Meeting.js'
import TimeSlot from '../models/TimeSlot.js'
import { authenticateUser } from '../middleware/auth.js'

const router = express.Router()

router.get('/', authenticateUser, async (req, res) => {
  try {
    const { status, timeframe } = req.query

    const query =
      req.user.role === 'candidate'
        ? { candidate: req.user.id }
        : { recruiter: req.user.id }

    if (status) {
      query.status = status
    }

    if (timeframe === 'upcoming') {
      query.startTime = { $gt: new Date() }
    } else if (timeframe === 'past') {
      query.endTime = { $lt: new Date() }
    }

    const meetings = await Meeting.find(query)
      .populate('candidate', 'name email')
      .populate('recruiter', 'name email')
      .sort({ startTime: 1 })

    res.status(200).json({ meetings })
  } catch (error) {
    console.error('Get meetings error:', error)
    res.status(500).json({ message: 'Failed to fetch meetings' })
  }
})

router.get('/:id', authenticateUser, async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id)
      .populate('candidate', 'name email')
      .populate('recruiter', 'name email')

    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found' })
    }

    if (
      meeting.candidate._id.toString() !== req.user.id &&
      meeting.recruiter._id.toString() !== req.user.id
    ) {
      return res
        .status(403)
        .json({ message: 'Not authorized to view this meeting' })
    }

    res.status(200).json({ meeting })
  } catch (error) {
    console.error('Get meeting error:', error)
    res.status(500).json({ message: 'Failed to fetch meeting' })
  }
})

export default router
