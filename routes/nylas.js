import express from 'express';
import Nylas from 'nylas';
import User from '../models/User.js';
import { authenticateUser } from '../middleware/auth.js';
import environmentVariables from '../utils/envConfig.js'

const router = express.Router();

const config = {
  clientId: environmentVariables.NYLAS_CLIENT_ID,
  clientSecret: environmentVariables.NYLAS_CLIENT_SECRET,
  redirectUri: environmentVariables.NYLAS_REDIRECT_URI
}

const nylas = new Nylas(config);


router.post('/connect', authenticateUser, async (req, res) => {
  try {
    const authUrl = nylas.auth.urlForOAuth2({
      clientId: config.clientId,
      provider: 'google',
      redirectUri: config.redirectUri,
      loginHint: req.user.email
    })
    
    res.status(200).json({ authUrl });
  } catch (error) {
    console.error('Nylas connect error:', error);
    res.status(500).json({ message: 'Failed to connect to Nylas' });
  }
});


router.get('/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    
    if (!code) {
      return res.status(400).json({ message: 'Authorization code is required' });
    }
    
    const response = await nylas.auth.exchangeCodeForToken({
      clientId: environmentVariables.NYLAS_CLIENT_ID,
      clientSecret:environmentVariables.NYLAS_CLIENT_SECRET,
      redirectUri: environmentVariables.NYLAS_REDIRECT_URI,
      code
    });

    const { accessToken, email, grantId } = response;

    
    
    const user = await User.findOne({ email: email });
    if (user) {
      user.nylasAccessToken = accessToken;
      user.grantId = grantId;
      await user.save();
    }
    
    res.redirect(`${process.env.FRONTEND_URL}/schedule?nylas_connected=true`);
  } catch (error) {
    console.error('Nylas callback error:', error);
    res.redirect(`${process.env.FRONTEND_URL}/schedule?nylas_connected=false`);
  }
});


router.get('/events', authenticateUser, async (req, res) => {

  try {
    const user = await User.findById(req.user.id);
    if (!user || !user.nylasAccessToken) {
      return res.status(400).json({ message: 'Nylas not connected' });
    }

  const nylasConfig = {
      clientId: environmentVariables.NYLAS_CLIENT_ID,
      apiKey: environmentVariables.NYLAS_CLIENT_SECRET,
      redirectUri: environmentVariables.NYLAS_REDIRECT_URI,
      apiUri: environmentVariables.NYLAS_API_URI
    }


    const nylas = new Nylas(nylasConfig)
    
    const { startDate, endDate } = req.query;
    const start = startDate ? new Date(startDate) : new Date();
    const end = endDate ? new Date(endDate) : new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000); 
    
    const events = await nylas.events.list({
      identifier: user.grantId,
      queryParams: {
        calendarId: 'primary',
      }
    })
    res.status(200).json({ events });

  } catch (error) {
    console.error('Get Nylas events error:', error);
    res.status(500).json({ message: 'Failed to fetch calendar events' });
  }
});


router.post('/events', authenticateUser, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || !user.nylasAccessToken) {
      return res.status(400).json({ message: 'Nylas not connected' });
    }
    
    const nylas = Nylas.with(user.nylasAccessToken);
    const { title, description, startTime, endTime, participants, location } = req.body;
    
    const event = nylas.events.build({
      title,
      description,
      location,
      when: {
        start_time: Math.floor(new Date(startTime).getTime() / 1000),
        end_time: Math.floor(new Date(endTime).getTime() / 1000),
      },
      participants: participants.map(email => ({ email })),
    });
    
    await event.save();
    
    res.status(201).json({ message: 'Event created successfully', event });
  } catch (error) {
    console.error('Create Nylas event error:', error);
    res.status(500).json({ message: 'Failed to create calendar event' });
  }
});


router.put('/events/:id', authenticateUser, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || !user.nylasAccessToken) {
      return res.status(400).json({ message: 'Nylas not connected' });
    }
    
    const nylas = Nylas.with(user.nylasAccessToken);
    const { title, description, startTime, endTime, participants, location } = req.body;
    
    const event = await nylas.events.find(req.params.id);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }
    
    
    event.title = title;
    event.description = description;
    event.location = location;
    event.when = {
      start_time: Math.floor(new Date(startTime).getTime() / 1000),
      end_time: Math.floor(new Date(endTime).getTime() / 1000),
    };
    event.participants = participants.map(email => ({ email }));
    
    await event.save();
    
    res.status(200).json({ message: 'Event updated successfully', event });
  } catch (error) {
    console.error('Update Nylas event error:', error);
    res.status(500).json({ message: 'Failed to update calendar event' });
  }
});


router.delete('/events/:id', authenticateUser, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || !user.nylasAccessToken) {
      return res.status(400).json({ message: 'Nylas not connected' });
    }
    
    const nylas = Nylas.with(user.nylasAccessToken);
    
    const event = await nylas.events.find(req.params.id);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }
    
    await event.destroy();
    
    res.status(200).json({ message: 'Event deleted successfully' });
  } catch (error) {
    console.error('Delete Nylas event error:', error);
    res.status(500).json({ message: 'Failed to delete calendar event' });
  }
});

export default router;
