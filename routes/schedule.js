import express from 'express'
import Recruiter from '../models/Recruiter.js'
import Candidate from '../models/Candidate.js'
import Meeting from '../models/Meeting.js'
import { authenticateUser, authorizeRole } from '../middleware/auth.js'

const router = express.Router()

router.get(
  '/candidates',
  authenticateUser,
  authorizeRole(['recruiter']),
  async (req, res) => {
    try {
      const candidates = await Candidate.find({}).select(
        'name email createdAt status'
      )

      res.status(200).json({ candidates })
    } catch (error) {
      console.error('Get candidates error:', error)
      res.status(500).json({ message: 'Failed to fetch candidates' })
    }
  }
)

router.get(
  '/candidates/:id',
  authenticateUser,
  authorizeRole(['recruiter']),
  async (req, res) => {
    try {
      const candidate = await Candidate.findById(req.params.id) 

      if (!candidate) {
        return res.status(404).json({ message: 'Candidate not found' })
      }

      const meetings = await Meeting.find({
        recruiter: req.user.id,
        candidate: req.params.id
      }).sort('-startTime')

      let availabilityStatus = 'unknown'

      if (meetings.length > 0) {
        const latestMeeting = meetings[0]

        if (latestMeeting.status === 'scheduled') {
          availabilityStatus = 'scheduled'
        } else if (latestMeeting.status === 'completed') {
          availabilityStatus = 'interviewed'
        }
      } else {
        const timeSlots = await TimeSlot.find({
          user: req.params.id,
          status: 'available',
          startTime: { $gt: new Date() }
        })

        availabilityStatus = timeSlots.length > 0 ? 'available' : 'unavailable'
      }

      res.status(200).json({
        candidate: {
          id: candidate._id,
          name: candidate.name,
          email: candidate.email,
          createdAt: candidate.createdAt
        },
        availabilityStatus,
        meetings
      })
    } catch (error) {
      console.error('Get candidate details error:', error)
      res.status(500).json({ message: 'Failed to fetch candidate details' })
    }
  }
)

export default router
