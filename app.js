import express from 'express'
import mongoose from 'mongoose'
import cors from 'cors'
import dotenv from 'dotenv'
import cookieParser from 'cookie-parser'

import authRoutes from './routes/auth.js'
import meetingRoutes from './routes/meetings.js'
import availabilityRoutes from './routes/availability.js'
import scheduleRoutes from './routes/schedule.js'
import nylasRoutes from './routes/nylas.js'
import aiRoutes from './routes/ai.js'

dotenv.config()

const app = express()

const allowedOrigins = [
  'http://localhost:5173',
  'https://slotbot-client.vercel.app'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true 
}));



app.use(express.json())
app.use(cookieParser())

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

app.use('/api/auth', authRoutes)
app.use('/api/meetings', meetingRoutes)
app.use('/api/availability', availabilityRoutes)
app.use('/api/schedule', scheduleRoutes)
app.use('/api/nylas', nylasRoutes)
app.use('/api/ai', aiRoutes)


app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok' })
});

app.get("/", (req, res) => res.send("Express on Vercel"));


app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({ 
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  })
})



export default app;