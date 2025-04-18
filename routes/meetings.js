import express from 'express';
import Meeting from '../models/Meeting.js';
import TimeSlot from '../models/TimeSlot.js';
import User from '../models/User.js';
import { authenticateUser } from '../middleware/auth.js';

const router = express.Router();

// Get all meetings for current user
router.get('/', authenticateUser, async (req, res) => {
  try {
    const { status, timeframe } = req.query;
    
    const query = req.user.role === 'candidate' 
      ? { candidate: req.user.id } 
      : { recruiter: req.user.id };
    
    if (status) {
      query.status = status;
    }
    
    if (timeframe === 'upcoming') {
      query.startTime = { $gt: new Date() };
    } else if (timeframe === 'past') {
      query.endTime = { $lt: new Date() };
    }
    
    const meetings = await Meeting.find(query)
      .populate('candidate', 'name email')
      .populate('recruiter', 'name email')
      .sort({ startTime: 1 });
    
    res.status(200).json({ meetings });
  } catch (error) {
    console.error('Get meetings error:', error);
    res.status(500).json({ message: 'Failed to fetch meetings' });
  }
});

// Get a specific meeting
router.get('/:id', authenticateUser, async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id)
      .populate('candidate', 'name email')
      .populate('recruiter', 'name email');
    
    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found' });
    }
    
    // Check if user is authorized to view this meeting
    if (
      meeting.candidate._id.toString() !== req.user.id && 
      meeting.recruiter._id.toString() !== req.user.id
    ) {
      return res.status(403).json({ message: 'Not authorized to view this meeting' });
    }
    
    res.status(200).json({ meeting });
  } catch (error) {
    console.error('Get meeting error:', error);
    res.status(500).json({ message: 'Failed to fetch meeting' });
  }
});

// Create a new meeting (recruiter only)
router.post('/', authenticateUser, async (req, res) => {
  try {
    // Only recruiters can create meetings
    if (req.user.role !== 'recruiter') {
      return res.status(403).json({ message: 'Only recruiters can create meetings' });
    }
    
    const { 
      title, 
      description, 
      candidateId, 
      startTime, 
      endTime, 
      location, 
      videoLink 
    } = req.body;
    
    // Validate input
    if (!title || !candidateId || !startTime || !endTime) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    
    // Check if candidate exists
    const candidate = await User.findById(candidateId);
    if (!candidate || candidate.role !== 'candidate') {
      return res.status(404).json({ message: 'Candidate not found' });
    }
    
    const start = new Date(startTime);
    const end = new Date(endTime);
    
    // Check if there's an available time slot for this candidate
    const timeSlot = await TimeSlot.findOne({
      user: candidateId,
      status: 'available',
      startTime: { $lte: start },
      endTime: { $gte: end }
    });
    
    if (!timeSlot) {
      return res.status(400).json({ message: 'No available time slot for this meeting' });
    }
    
    // Create the meeting
    const meeting = new Meeting({
      title,
      description,
      recruiter: req.user.id,
      candidate: candidateId,
      startTime: start,
      endTime: end,
      location: location || 'Virtual Meeting',
      videoLink
    });
    
    await meeting.save();
    
    // Update the time slot status
    timeSlot.status = 'booked';
    timeSlot.meeting = meeting._id;
    await timeSlot.save();
    
    res.status(201).json({
      message: 'Meeting created successfully',
      meeting
    });
  } catch (error) {
    console.error('Create meeting error:', error);
    res.status(500).json({ message: 'Failed to create meeting' });
  }
});

// Update a meeting
router.put('/:id', authenticateUser, async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id);
    
    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found' });
    }
    
    // Only the meeting creator (recruiter) can update it
    if (meeting.recruiter.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to update this meeting' });
    }
    
    const { title, description, startTime, endTime, location, videoLink, status } = req.body;
    
    // Update fields
    if (title) meeting.title = title;
    if (description) meeting.description = description;
    if (location) meeting.location = location;
    if (videoLink) meeting.videoLink = videoLink;
    if (status) meeting.status = status;
    
    // Handle time changes
    if (startTime && endTime) {
      const start = new Date(startTime);
      const end = new Date(endTime);
      
      if (start >= end) {
        return res.status(400).json({ message: 'End time must be after start time' });
      }
      
      // If changing time, need to check available slots again
      if (
        start.getTime() !== meeting.startTime.getTime() || 
        end.getTime() !== meeting.endTime.getTime()
      ) {
        // Find the original time slot and release it
        const originalTimeSlot = await TimeSlot.findOne({
          user: meeting.candidate,
          meeting: meeting._id
        });
        
        if (originalTimeSlot) {
          originalTimeSlot.status = 'available';
          originalTimeSlot.meeting = null;
          await originalTimeSlot.save();
        }
        
        // Find a new available time slot
        const newTimeSlot = await TimeSlot.findOne({
          user: meeting.candidate,
          status: 'available',
          startTime: { $lte: start },
          endTime: { $gte: end }
        });
        
        if (!newTimeSlot) {
          return res.status(400).json({ message: 'No available time slot for these new times' });
        }
        
        // Book the new time slot
        newTimeSlot.status = 'booked';
        newTimeSlot.meeting = meeting._id;
        await newTimeSlot.save();
      }
      
      meeting.startTime = start;
      meeting.endTime = end;
    }
    
    await meeting.save();
    
    res.status(200).json({
      message: 'Meeting updated successfully',
      meeting
    });
  } catch (error) {
    console.error('Update meeting error:', error);
    res.status(500).json({ message: 'Failed to update meeting' });
  }
});

// Cancel a meeting
router.put('/:id/cancel', authenticateUser, async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id);
    
    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found' });
    }
    
    // Both candidate and recruiter can cancel
    if (
      meeting.recruiter.toString() !== req.user.id && 
      meeting.candidate.toString() !== req.user.id
    ) {
      return res.status(403).json({ message: 'Not authorized to cancel this meeting' });
    }
    
    // Don't allow cancelling completed meetings
    if (meeting.status === 'completed') {
      return res.status(400).json({ message: 'Cannot cancel a completed meeting' });
    }
    
    // Update meeting status
    meeting.status = 'cancelled';
    await meeting.save();
    
    // Free up the time slot
    const timeSlot = await TimeSlot.findOne({
      user: meeting.candidate,
      meeting: meeting._id
    });
    
    if (timeSlot) {
      timeSlot.status = 'available';
      timeSlot.meeting = null;
      await timeSlot.save();
    }
    
    res.status(200).json({
      message: 'Meeting cancelled successfully',
      meeting
    });
  } catch (error) {
    console.error('Cancel meeting error:', error);
    res.status(500).json({ message: 'Failed to cancel meeting' });
  }
});

export default router;