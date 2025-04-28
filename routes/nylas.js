import express from 'express'
import nylas, { nylasConfig } from '../utils/nylasConfig.js'
import { authenticateUser } from '../middleware/auth.js'
import Recruiter from '../models/Recruiter.js'
import Candidate from '../models/Candidate.js'

const router = express.Router()

const getUserModel = (role) => {
  if (role === 'recruiter') return Recruiter
  if (role === 'candidate') return Candidate
  throw new Error('Invalid role')
}

router.post('/connect', authenticateUser, async (req, res) => {
  try {
    const authUrl = nylas.auth.urlForOAuth2({
      clientId: nylasConfig.clientId,
      provider: 'google',
      redirectUri: nylasConfig.redirectUri,
      loginHint: req.user.email
    })

    res.status(200).json({ authUrl })
  } catch (error) {
    console.error('Nylas connect error:', error)
    res.status(500).json({ message: 'Failed to connect to Nylas' })
  }
})

router.get('/callback', async (req, res) => {
  try {
    const { code } = req.query

    if (!code) {
      return res.status(400).json({ message: 'Authorization code is required' })
    }

    const response = await nylas.auth.exchangeCodeForToken({
      clientId: nylasConfig.clientId,
      clientSecret: nylasConfig.clientSecret,
      redirectUri: nylasConfig.redirectUri,
      code
    })

    const { accessToken, email, grantId } = response

    let user = await Candidate.findOne({ email })
    if (!user) {
      user = await Recruiter.findOne({ email })
    }

    if (user) {
      user.nylasAccessToken = accessToken
      user.grantId = grantId
      await user.save()
    }

    res.redirect(`${process.env.FRONTEND_URL}/schedule?nylas_connected=true`)
  } catch (error) {
    console.error('Nylas callback error:', error)
    res.redirect(`${process.env.FRONTEND_URL}/schedule?nylas_connected=false`)
  }
})

router.get('/events', authenticateUser, async (req, res) => {
  try {
    const UserModel = getUserModel(req.user.role)
    const user = await UserModel.findById(req.user.id)
    if (!user || !user.nylasAccessToken) {
      return res.status(400).json({ message: 'Nylas not connected' })
    }

    const { startDate, endDate } = req.query
    const start = startDate ? new Date(startDate) : new Date()
    const end = endDate
      ? new Date(endDate)
      : new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000)

    const events = await nylas.events.list({
      identifier: user.grantId,
      queryParams: {
        calendarId: 'primary'
      }
    })
    res.status(200).json({ events })
  } catch (error) {
    console.error('Get Nylas events error:', error)
    res.status(500).json({ message: 'Failed to fetch calendar events' })
  }
})

router.post('/events', authenticateUser, async (req, res) => {
  try {
    const user = await Recruiter.findById(req.user.id)
    if (!user || !user.nylasAccessToken || !user.nylasGrantId) {
      return res.status(400).json({ message: 'Nylas not connected' })
    }

    const {
      title,
      description,
      startTime,
      endTime,
      participants,
      location,
      calendarId
    } = req.body

    if (!calendarId) {
      return res.status(400).json({ message: 'calendarId is required' })
    }

    const event = await nylas.events.create({
      identifier: user.nylasGrantId,
      requestBody: {
        title,
        description,
        location,
        when: {
          startTime: new Date(startTime).toISOString(),
          endTime: new Date(endTime).toISOString()
        },
        participants:
          participants?.map((p) => ({
            email: p.email,
            name: p.name || ''
          })) || []
      },
      queryParams: {
        calendarId
      }
    })

    res.status(201).json({ message: 'Event created successfully', event })
  } catch (error) {
    console.error('Create Nylas event error:', error)
    res.status(500).json({ message: 'Failed to create calendar event' })
  }
})

export default router
