import express from 'express';
import TimeSlot from '../models/TimeSlot.js';
import { authenticateUser, authorizeRole } from '../middleware/auth.js';

const router = express.Router();

// Get user's available time slots
router.get('/', authenticateUser, async (req, res) => {
  try {
    const { status } = req.query;
    
    const query = { user: req.user.id };
    if (status) {
      query.status = status;
    }
    
    const timeSlots = await TimeSlot.find(query).sort('startTime');
    
    res.status(200).json({ timeSlots });
  } catch (error) {
    console.error('Get time slots error:', error);
    res.status(500).json({ message: 'Failed to fetch time slots' });
  }
});

// Add a new time slot
router.post('/', authenticateUser, authorizeRole(['candidate']), async (req, res) => {
  try {
    const { startTime, endTime } = req.body;
    
    // Validate input
    if (!startTime || !endTime) {
      return res.status(400).json({ message: 'Start time and end time are required' });
    }
    
    const start = new Date(startTime);
    const end = new Date(endTime);
    
    if (start >= end) {
      return res.status(400).json({ message: 'End time must be after start time' });
    }
    
    if (start < new Date()) {
      return res.status(400).json({ message: 'Start time must be in the future' });
    }
    
    // Check for overlapping time slots
    const overlappingSlots = await TimeSlot.find({
      user: req.user.id,
      $or: [
        { startTime: { $lt: end }, endTime: { $gt: start } }
      ]
    });
    
    if (overlappingSlots.length > 0) {
      return res.status(400).json({ message: 'Time slot overlaps with existing slots' });
    }
    
    // Create new time slot
    const timeSlot = new TimeSlot({
      user: req.user.id,
      startTime: start,
      endTime: end,
      status: 'available'
    });
    
    await timeSlot.save();
    
    res.status(201).json({
      message: 'Time slot added successfully',
      timeSlot
    });
  } catch (error) {
    console.error('Add time slot error:', error);
    res.status(500).json({ message: 'Failed to add time slot' });
  }
});

// Update a time slot
router.put('/:id', authenticateUser, authorizeRole(['candidate']), async (req, res) => {
  try {
    const { startTime, endTime, status } = req.body;
    
    // Find time slot
    const timeSlot = await TimeSlot.findOne({
      _id: req.params.id,
      user: req.user.id
    });
    
    if (!timeSlot) {
      return res.status(404).json({ message: 'Time slot not found' });
    }
    
    // Check if already booked
    if (timeSlot.status === 'booked' && status === 'available') {
      return res.status(400).json({ message: 'Cannot update a booked time slot' });
    }
    
    // Update time slot
    if (startTime) timeSlot.startTime = new Date(startTime);
    if (endTime) timeSlot.endTime = new Date(endTime);
    if (status) timeSlot.status = status;
    
    await timeSlot.save();
    
    res.status(200).json({
      message: 'Time slot updated successfully',
      timeSlot
    });
  } catch (error) {
    console.error('Update time slot error:', error);
    res.status(500).json({ message: 'Failed to update time slot' });
  }
});

// Delete a time slot
router.delete('/:id', authenticateUser, authorizeRole(['candidate']), async (req, res) => {
  try {
    // Find time slot
    const timeSlot = await TimeSlot.findOne({
      _id: req.params.id,
      user: req.user.id
    });
    
    if (!timeSlot) {
      return res.status(404).json({ message: 'Time slot not found' });
    }
    
    // Check if already booked
    if (timeSlot.status === 'booked') {
      return res.status(400).json({ message: 'Cannot delete a booked time slot' });
    }
    
    await timeSlot.remove();
    
    res.status(200).json({ message: 'Time slot deleted successfully' });
  } catch (error) {
    console.error('Delete time slot error:', error);
    res.status(500).json({ message: 'Failed to delete time slot' });
  }
});

// Get available time slots for a specific candidate (recruiter only)
router.get('/candidate/:id', authenticateUser, authorizeRole(['recruiter']), async (req, res) => {
  try {
    const timeSlots = await TimeSlot.find({
      user: req.params.id,
      status: 'available',
      startTime: { $gt: new Date() }
    }).sort('startTime');
    
    res.status(200).json({ timeSlots });
  } catch (error) {
    console.error('Get candidate time slots error:', error);
    res.status(500).json({ message: 'Failed to fetch candidate time slots' });
  }
});

export default router;