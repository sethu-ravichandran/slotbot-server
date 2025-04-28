import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'

const recruiterSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        'Please enter a valid email'
      ]
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: 8,
      select: false
    },
    nylasAccessToken: {
      type: String,
      default: null
    },
    grantId: {
      type: String,
      default: null
    },
    role: {
      type: String,
      default: 'recruiter'
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
)

recruiterSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next()

  try {
    const salt = await bcrypt.genSalt(10)
    this.password = await bcrypt.hash(this.password, salt)
    next()
  } catch (error) {
    next(error)
  }
})

recruiterSchema.methods.comparePassword = async function (recruiterPassword) {
  return bcrypt.compare(recruiterPassword, this.password)
}

const Recruiter = mongoose.model('Recruiter', recruiterSchema)

export default Recruiter
