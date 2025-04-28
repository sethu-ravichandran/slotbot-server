import express from 'express'
import TimeSlot from '../models/TimeSlot.js'
import Candidate from '../models/Candidate.js'
import { authenticateUser, authorizeRole } from '../middleware/auth.js'

const router = express.Router()

router.get('/', authenticateUser, async (req, res) => {
  try {
    const { status } = req.query

    const query = { user: req.user.id }
    if (status) {
      query.status = status
    }

    const timeSlots = await TimeSlot.find(query).sort('startTime')

    res.status(200).json({ timeSlots })
  } catch (error) {
    console.error('Get time slots error:', error)
    res.status(500).json({ message: 'Failed to fetch time slots' })
  }
})

router.get('/:id', authenticateUser, async (req, res) => {
  try {
    const candidateId = req.params.id

    const candidate = await Candidate.findById(candidateId).select(
      'name email status'
    )
    if (!candidate) {
      return res.status(404).json({ message: 'Candidate not found' })
    }

    const availableSlots = await TimeSlot.find({
      user: candidateId,
      status: 'available'
    }).select('startTime endTime')

    const formattedSlots = availableSlots.map((slot) => ({
      id: slot._id,
      startTime: slot.startTime,
      endTime: slot.endTime
    }))

    res.json({
      candidate,
      availableSlots: formattedSlots
    })
  } catch (error) {
    console.error('Error fetching candidate slots:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

router.post(
  '/',
  authenticateUser,
  authorizeRole(['candidate']),
  async (req, res) => {
    try {
      const slots = req.body

      if (!Array.isArray(slots) || slots.length === 0) {
        return res.status(400).json({ message: 'Slots array is required' })
      }

      const createdSlots = []

      for (const slot of slots) {
        const { startTime, endTime } = slot

        if (!startTime || !endTime) {
          return res
            .status(400)
            .json({ message: 'Each slot must have a startTime and endTime' })
        }

        const start = new Date(startTime)
        const end = new Date(endTime)

        if (start >= end) {
          return res
            .status(400)
            .json({ message: 'End time must be after start time' })
        }

        if (start < new Date()) {
          return res
            .status(400)
            .json({ message: 'Start time must be in the future' })
        }

        const overlappingSlots = await TimeSlot.find({
          user: req.user.id,
          $or: [{ startTime: { $lt: end }, endTime: { $gt: start } }]
        })

        if (overlappingSlots.length > 0) {
          return res
            .status(400)
            .json({ message: 'One or more slots overlap with existing slots' })
        }

        const timeSlot = new TimeSlot({
          user: req.user.id,
          startTime: start,
          endTime: end,
          status: 'available'
        })

        await timeSlot.save()
        createdSlots.push(timeSlot)
      }

      res.status(201).json({
        message: 'Time slots added successfully',
        timeSlots: createdSlots
      })
    } catch (error) {
      console.error('Add time slot error:', error)
      res.status(500).json({ message: 'Failed to add time slots' })
    }
  }
)

router.delete(
  '/:id',
  authenticateUser,
  authorizeRole(['candidate']),
  async (req, res) => {
    try {
      const timeSlot = await TimeSlot.findOne({
        _id: req.params.id,
        user: req.user.id
      })

      if (!timeSlot) {
        return res.status(404).json({ message: 'Time slot not found' })
      }

      if (timeSlot.status === 'booked') {
        return res
          .status(400)
          .json({ message: 'Cannot delete a booked time slot' })
      }

      await timeSlot.deleteOne()

      res.status(200).json({ message: 'Time slot deleted successfully' })
    } catch (error) {
      console.error('Delete time slot error:', error)
      res.status(500).json({ message: 'Failed to delete time slot' })
    }
  }
)

export default router
