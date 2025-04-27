import express from 'express';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import User from '../models/User.js';
import TimeSlot from '../models/TimeSlot.js';
import Meeting from '../models/Meeting.js';
import { authenticateUser, authorizeRole } from '../middleware/auth.js';

dotenv.config();

const router = express.Router();


const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });


router.post('/match', authenticateUser, authorizeRole(['recruiter']), async (req, res) => {
  try {
    const { candidateId, duration, preferences } = req.body;

    if (!candidateId || !duration) {
      return res.status(400).json({ message: 'Candidate ID and duration are required' });
    }

    const recruiter = await User.findById(req.user.id);
    if (!recruiter) {
      return res.status(404).json({ message: 'Recruiter not found' });
    }

    const candidate = await User.findById(candidateId);
    if (!candidate || candidate.role !== 'candidate') {
      return res.status(404).json({ message: 'Candidate not found' });
    }

    const candidateSlots = await TimeSlot.find({
      user: candidateId,
      status: 'available',
      startTime: { $gt: new Date() }
    }).sort('startTime');

    if (candidateSlots.length === 0) {
      return res.status(404).json({ message: 'No available time slots found for this candidate' });
    }

    const recruiterMeetings = await Meeting.find({
      recruiter: req.user.id,
      status: 'scheduled',
      startTime: { $gt: new Date() }
    }).sort('startTime');

    const candidateAvailability = candidateSlots.map(slot => ({
      start: slot.startTime.toISOString(),
      end: slot.endTime.toISOString(),
    }));

    const recruiterBusyTimes = recruiterMeetings.map(meeting => ({
      start: meeting.startTime.toISOString(),
      end: meeting.endTime.toISOString(),
    }));

    const prompt = `
      Schedule a meeting between a recruiter and a candidate.

      Candidate's available times:
      ${JSON.stringify(candidateAvailability)}

      Recruiter's busy times:
      ${JSON.stringify(recruiterBusyTimes)}

      Recruiter's preferences:
      ${JSON.stringify(preferences || {})}

      Meeting duration: ${duration} minutes.

      Rules:
      - No conflict with busy times
      - Respect preferences
      - Prefer buffer time before/after
      - Avoid back-to-back meetings

      Respond ONLY with a JSON array of the top 3 ISO start times, sorted by preference.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash', 
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    let suggestedTimes;
    try {
      const aiText = response.response.candidates[0].content.parts[0].text.trim();
      suggestedTimes = JSON.parse(aiText);

      if (!Array.isArray(suggestedTimes)) {
        throw new Error('Invalid AI response format');
      }
    } catch (error) {
      console.error('Error parsing Gemini response:', error);
      return res.status(500).json({ message: 'Error processing AI suggestions' });
    }

    res.status(200).json({
      message: 'Successfully found optimal meeting times',
      suggestedTimes,
    });
  } catch (error) {
    console.error('Gemini matching error:', error);
    res.status(500).json({ message: 'Failed to process optimal meeting times' });
  }
});


router.post('/generate-description', authenticateUser, authorizeRole(['recruiter']), async (req, res) => {
  try {
    const { candidateId, position, skills, experience } = req.body;

    const candidate = await User.findById(candidateId);
    if (!candidate) {
      return res.status(404).json({ message: 'Candidate not found' });
    }

    const prompt = `
      Write a short professional job interview invitation.

      Details:
      - Position: ${position}
      - Required skills: ${skills}
      - Experience level: ${experience}

      The description must:
      - Be under 200 words
      - Mention what to prepare
      - Explain interview format
      - Include expected duration
      - Provide any special instructions
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    const description = response.response.candidates[0].content.parts[0].text.trim();

    res.status(200).json({
      message: 'Successfully generated meeting description',
      description,
    });
  } catch (error) {
    console.error('Gemini description generation error:', error);
    res.status(500).json({ message: 'Failed to generate meeting description' });
  }
});

export default router;
