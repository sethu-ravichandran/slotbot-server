import express from 'express';
import User from '../models/User.js';
import Meeting from '../models/Meeting.js';
import { authenticateUser, authorizeRole } from '../middleware/auth.js';

const router = express.Router();

// Get recruiter's schedule (busy times)
router.get('/busy-times', authenticateUser, authorizeRole(['recruiter']), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const start = startDate ? new Date(startDate) : new Date();
    const end = endDate ? new Date(endDate) : new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000); // Default to 1 week
    
    // Find all scheduled meetings in the date range
    const meetings = await Meeting.find({
      recruiter: req.user.id,
      status: 'scheduled',
      startTime: { $gte: start },
      endTime: { $lte: end }
    }).sort('startTime');
    
    const busyTimes = meetings.map(meeting => ({
      id: meeting._id,
      title: meeting.title,
      start: meeting.startTime,
      end: meeting.endTime
    }));
    
    res.status(200).json({ busyTimes });
  } catch (error) {
    console.error('Get busy times error:', error);
    res.status(500).json({ message: 'Failed to fetch busy times' });
  }
});

// Get all candidates (for recruiters)
router.get('/candidates', authenticateUser, authorizeRole(['recruiter']), async (req, res) => {
  try {
    const candidates = await User.find({ role: 'candidate' })
      .select('name email createdAt');
    
    res.status(200).json({ candidates });
  } catch (error) {
    console.error('Get candidates error:', error);
    res.status(500).json({ message: 'Failed to fetch candidates' });
  }
});

// Get candidate details with availability status
router.get('/candidates/:id', authenticateUser, authorizeRole(['recruiter']), async (req, res) => {
  try {
    const candidate = await User.findById(req.params.id);
    
    if (!candidate || candidate.role !== 'candidate') {
      return res.status(404).json({ message: 'Candidate not found' });
    }
    
    // Get existing meetings with this candidate
    const meetings = await Meeting.find({
      recruiter: req.user.id,
      candidate: req.params.id
    }).sort('-startTime');
    
    // Calculate availability status
    let availabilityStatus = 'unknown';
    
    if (meetings.length > 0) {
      const latestMeeting = meetings[0];
      
      if (latestMeeting.status === 'scheduled') {
        availabilityStatus = 'scheduled';
      } else if (latestMeeting.status === 'completed') {
        availabilityStatus = 'interviewed';
      }
    } else {
      // Check if candidate has any available time slots
      const timeSlots = await TimeSlot.find({
        user: req.params.id,
        status: 'available',
        startTime: { $gt: new Date() }
      });
      
      availabilityStatus = timeSlots.length > 0 ? 'available' : 'unavailable';
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
    });
  } catch (error) {
    console.error('Get candidate details error:', error);
    res.status(500).json({ message: 'Failed to fetch candidate details' });
  }
});

export default router;