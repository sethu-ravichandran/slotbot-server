import express from 'express'
import jwt from 'jsonwebtoken'
import Candidate from '../models/Candidate.js'
import Recruiter from '../models/Recruiter.js'
import { authenticateUser } from '../middleware/auth.js'
import environmentVariables from '../utils/envConfig.js'

const router = express.Router()

const getUserModel = (role) => {
  if (role == 'candidate') return Candidate
  if (role == 'recruiter') return Recruiter
  throw new Error('Invalid role')
}

router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body

    if (!role) {
      return res.status(400).json({ message: 'Role is required' })
    }

    const UserModel = getUserModel(role)

    const existingUser = await UserModel.findOne({ email })
    if (existingUser) {
      return res
        .status(400)
        .json({ message: 'User already exists with this email' })
    }

    const user = new UserModel({ name, email, password })
    await user.save()

    res.status(201).json({
      message: 'User registered successfully. Please login to continue.',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: role
      }
    })
  } catch (error) {
    console.error('Registration error:', error)
    res.status(500).json({ message: 'Server error during registration' })
  }
})

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body

    console.log('Login route hit with data:', { email: req.body.email, passwordProvided: !!req.body.password });

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: 'Email and password are required' })
    }

    let user
    let role

    user = await Candidate.findOne({ email }).select('+password')
    if (user) {
      role = 'candidate'
    } else {
      user = await Recruiter.findOne({ email }).select('+password')
      if (user) {
        role = 'recruiter'
      }
    }

    console.log('User found:', { userId: user._id, role });

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' })
    }

    const isMatch = await user.comparePassword(password)
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' })
    }

    const token = jwt.sign(
      { id: user._id, email: user.email, role },
      environmentVariables.JWT_SECRET,
      { expiresIn: '7d' }
    )

    console.log('JWT_SECRET available:', !!environmentVariables.JWT_SECRET);

    res.cookie('token', token, {
      httpOnly: true,
      secure: environmentVariables.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/' ,
      domain: '.vercel.app'
    })

    console.log(token)

    res.status(200).json({
      message: 'Login successful',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role
      }
    })
  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({ message: 'Server error during login' })
  }
})

router.post('/logout', (req, res) => {
  res.clearCookie('token')
  res.status(200).json({ message: 'Logged out successfully' })
})

router.get('/me', authenticateUser, async (req, res) => {
  try {
    const UserModel = getUserModel(req.user.role)

    const user = await UserModel.findById(req.user.id)
    if (!user) {
      return res.status(404).json({ message: 'User not found' })
    }

    res.status(200).json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: req.user.role
      }
    })
  } catch (error) {
    console.error('Get user error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

router.put('/profile', authenticateUser, async (req, res) => {
  try {
    const { name, email } = req.body
    const UserModel = getUserModel(req.user.role)

    if (email) {
      const existingUser = await UserModel.findOne({
        email,
        _id: { $ne: req.user.id }
      })
      if (existingUser) {
        return res.status(400).json({ message: 'Email is already taken' })
      }
    }

    const updatedUser = await UserModel.findByIdAndUpdate(
      req.user.id,
      { name, email },
      { new: true, runValidators: true }
    )

    res.status(200).json({
      message: 'Profile updated successfully',
      user: {
        id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: req.user.role
      }
    })
  } catch (error) {
    console.error('Update profile error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

router.put('/password', authenticateUser, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body
    const UserModel = getUserModel(req.user.role)

    const user = await UserModel.findById(req.user.id).select('+password')
    if (!user) {
      return res.status(404).json({ message: 'User not found' })
    }

    const isMatch = await user.comparePassword(currentPassword)
    if (!isMatch) {
      return res.status(401).json({ message: 'Current password is incorrect' })
    }

    user.password = newPassword
    await user.save()

    res.status(200).json({ message: 'Password updated successfully' })
  } catch (error) {
    console.error('Change password error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

export default router
