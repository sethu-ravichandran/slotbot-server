import express from 'express';
import OpenAI from 'openai';
import User from '../models/User.js';
import TimeSlot from '../models/TimeSlot.js';
import Meeting from '../models/Meeting.js';
import dotenv from 'dotenv'
import { authenticateUser, authorizeRole } from '../middleware/auth.js';

dotenv.config()

const router = express.Router();

// Initialize OpenAI with your API keys
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Find optimal meeting times based on AI matching
router.post('/match', authenticateUser, authorizeRole(['recruiter']), async (req, res) => {
  try {
    const { candidateId, duration, preferences } = req.body;
    
    // Validate input
    if (!candidateId || !duration) {
      return res.status(400).json({ message: 'Candidate ID and duration are required' });
    }
    
    // Get recruiter (current user)
    const recruiter = await User.findById(req.user.id);
    if (!recruiter) {
      return res.status(404).json({ message: 'Recruiter not found' });
    }
    
    // Get candidate
    const candidate = await User.findById(candidateId);
    if (!candidate || candidate.role !== 'candidate') {
      return res.status(404).json({ message: 'Candidate not found' });
    }
    
    // Get candidate's available time slots
    const candidateSlots = await TimeSlot.find({
      user: candidateId,
      status: 'available',
      startTime: { $gt: new Date() }
    }).sort('startTime');
    
    if (candidateSlots.length === 0) {
      return res.status(404).json({ message: 'No available time slots found for this candidate' });
    }
    
    // Get recruiter's busy times (existing meetings)
    const recruiterMeetings = await Meeting.find({
      recruiter: req.user.id,
      status: 'scheduled',
      startTime: { $gt: new Date() }
    }).sort('startTime');
    
    // Prepare data for AI matching
    const candidateAvailability = candidateSlots.map(slot => ({
      start: slot.startTime.toISOString(),
      end: slot.endTime.toISOString(),
    }));
    
    const recruiterBusyTimes = recruiterMeetings.map(meeting => ({
      start: meeting.startTime.toISOString(),
      end: meeting.endTime.toISOString(),
    }));
    
    // Use OpenAI to find optimal meeting times
    const prompt = `
      I need to schedule a meeting between a recruiter and a candidate.
      
      Candidate's available times:
      ${JSON.stringify(candidateAvailability)}
      
      Recruiter's busy times:
      ${JSON.stringify(recruiterBusyTimes)}
      
      Recruiter's preferences:
      ${JSON.stringify(preferences || {})}
      
      Meeting duration: ${duration} minutes
      
      Please provide the top 3 optimal meeting times based on:
      1. No overlap with recruiter's busy times
      2. Respecting recruiter's preferences (if any)
      3. Prioritizing times that allow for buffer before and after
      4. Avoiding back-to-back meetings for the recruiter
      
      Return only a JSON array of start times in ISO format, sorted by preference.
    `;
    
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: "You are a helpful AI assistant for scheduling optimal meeting times." },
        { role: "user", content: prompt }
      ],
      temperature: 0.2,
    });
    
    // Parse AI response
    let suggestedTimes;
    try {
      const aiResponse = completion.choices[0].message.content.trim();
      suggestedTimes = JSON.parse(aiResponse);
      
      // Validate format
      if (!Array.isArray(suggestedTimes)) {
        throw new Error('Invalid response format');
      }
    } catch (error) {
      console.error('Error parsing AI response:', error);
      return res.status(500).json({ message: 'Error processing AI suggestions' });
    }
    
    res.status(200).json({
      message: 'Successfully found optimal meeting times',
      suggestedTimes,
    });
  } catch (error) {
    console.error('AI matching error:', error);
    res.status(500).json({ message: 'Failed to process optimal meeting times' });
  }
});

// Generate meeting description based on job and candidate profile
router.post('/generate-description', authenticateUser, authorizeRole(['recruiter']), async (req, res) => {
  try {
    const { candidateId, position, skills, experience } = req.body;
    
    // Get candidate
    const candidate = await User.findById(candidateId);
    if (!candidate) {
      return res.status(404).json({ message: 'Candidate not found' });
    }
    
    // Use OpenAI to generate meeting description
    const prompt = `
      Create a professional meeting invitation description for a job interview.
      
      Position: ${position}
      Required skills: ${skills}
      Experience level: ${experience}
      
      The description should:
      1. Be professional and concise
      2. Include what the candidate should prepare for
      3. Explain the interview format
      4. Mention expected duration
      5. Provide any special instructions
      
      Keep it under 200 words.
    `;
    
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: "You are a professional HR assistant writing interview invitations." },
        { role: "user", content: prompt }
      ],
      temperature: 0.7,
    });
    
    const description = completion.choices[0].message.content.trim();
    
    res.status(200).json({
      message: 'Successfully generated meeting description',
      description,
    });
  } catch (error) {
    console.error('AI description generation error:', error);
    res.status(500).json({ message: 'Failed to generate meeting description' });
  }
});

export default router;