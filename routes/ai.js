import express from 'express'
import { GoogleGenAI } from '@google/genai'
import dotenv from 'dotenv'
import nylas from '../utils/nylasConfig.js'
import Recruiter from '../models/Recruiter.js'
import Candidate from '../models/Candidate.js'
import TimeSlot from '../models/TimeSlot.js'
import Meeting from '../models/Meeting.js'
import environmentVariables from '../utils/envConfig.js'
import { authenticateUser, authorizeRole } from '../middleware/auth.js'

dotenv.config()

const router = express.Router()

const ai = new GoogleGenAI({ apiKey: environmentVariables.GEMINI_API_KEY })

router.post(
  '/match',
  authenticateUser,
  authorizeRole(['recruiter']),
  async (req, res) => {
    try {
      const { candidateId, duration, preferences } = req.body

      if (!candidateId || !duration) {
        return res
          .status(400)
          .json({ message: 'Candidate ID and duration are required' })
      }

      const recruiter = await Recruiter.findById(req.user.id)
      if (!recruiter || !recruiter.nylasAccessToken || !recruiter.grantId) {
        return res
          .status(400)
          .json({ message: 'Recruiter not found or Nylas not connected' })
      }

      const candidate = await Candidate.findById(candidateId)
      if (!candidate) {
        return res.status(404).json({ message: 'Candidate not found' })
      }

      const candidateSlots = await TimeSlot.find({
        user: candidateId,
        status: 'available',
        startTime: { $gt: new Date() }
      }).sort('startTime')

      if (candidateSlots.length === 0) {
        return res.status(404).json({ message: 'No available time slots' })
      }

      const recruiterMeetings = await Meeting.find({
        recruiter: req.user.id,
        status: 'scheduled',
        startTime: { $gt: new Date() }
      }).sort('startTime')

      const candidateAvailability = candidateSlots.map((slot) => ({
        start: slot.startTime.toISOString(),
        end: slot.endTime.toISOString()
      }))

      const recruiterBusyTimes = recruiterMeetings.map((meeting) => ({
        start: meeting.startTime.toISOString(),
        end: meeting.endTime.toISOString()
      }))

      const prompt = `
        Schedule a meeting between a recruiter and a candidate.

        Candidate's available times:
        ${JSON.stringify(candidateAvailability)}

        Recruiter's busy times:
        ${JSON.stringify(recruiterBusyTimes)}

        Recruiter's daily availability window (time of day only):
        ${JSON.stringify(preferences || {})}

        Meeting duration: ${duration} minutes.

        Rules:
        - Do not schedule during busy times.
        - Respect recruiter's time-of-day preferences.
        - Prefer buffer time before/after meetings.
        - Avoid back-to-back meetings.

        Respond with the top one suggested ISO start time.
      `

      const response = await ai.models.generateContent({
        model: 'gemini-1.5-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }]
      })

      let suggestedTime
      try {
        const aiText = response.candidates[0].content.parts[0].text.trim()
        const cleanIsoText = aiText.replace(/```json|```/g, '').trim()
        const date = new Date(cleanIsoText)
        if (isNaN(date.getTime())) {
          throw new Error('Invalid ISO date format')
        }
        suggestedTime = cleanIsoText
      } catch (error) {
        console.error('Error parsing Gemini response:', error)
        return res
          .status(500)
          .json({ message: 'Error processing AI suggestion' })
      }

      const nylasEvent = await nylas.events.create({
        identifier: recruiter.grantId,
        requestBody: {
          title: `Meeting with ${candidate.name} | ${recruiter.name}`,
          description: `A formal meeting`,
          location: `Virtual (Online)`,
          when: {
            startTime: Math.floor(new Date(suggestedTime).getTime() / 1000),
            endTime: Math.floor(
              new Date(new Date(suggestedTime).getTime() + duration * 60000).getTime() / 1000
            )
          },
          participants: [
            {
              email: candidate.email,
              name: candidate.name
            }
          ],
          conferencing: {
            provider: 'Google Meet',
            autocreate: {}
          }
        },
        queryParams: {
          calendarId: 'primary'
        }
      })

      candidate.status = 'scheduled'
      await candidate.save()

      const newMeeting = new Meeting({
        title: `Meeting with ${candidate.name} | ${recruiter.name}`,
        description: `A formal meeting between ${recruiter.name} and ${candidate.name}`,
        recruiter: recruiter._id,
        candidate: candidate._id,
        startTime: new Date(suggestedTime),
        endTime: new Date(new Date(suggestedTime).getTime() + duration * 60000),
        status: 'scheduled',
        nylasEventId: nylasEvent.id,
        videoCallLink: nylasEvent.data.conferencing.details.url,
        calendarLink: nylasEvent.data.htmlLink
      })

      await newMeeting.save()

      res.status(200).json({
        message: 'Successfully found and scheduled meeting',
        suggestedTime,
        event: nylasEvent
      })
    } catch (error) {
      console.error('Gemini matching error:', error)
      res.status(500).json({ message: 'Failed to process optimal meeting time' })
    }
  }
)

export default router
