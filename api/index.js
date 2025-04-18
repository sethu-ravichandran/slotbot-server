import app from '../app.js'
import cors from 'cors'

app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}))

export default app