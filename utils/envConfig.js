import dotenv from 'dotenv'
dotenv.config()
 
const environmentVariables = {
    PORT:process.env.PORT,
    NODE_ENV:process.env.NODE_ENV,
    FRONTEND_URL:process.env.FRONTEND_URL,
    BACKEND_URL:process.env.BACKEND_URL,
    JWT_SECRET:process.env.JWT_SECRET,
    MONGODB_URI:process.env.MONGODB_URI,
    NYLAS_CLIENT_ID:process.env.NYLAS_CLIENT_ID,
    NYLAS_CLIENT_SECRET:process.env.NYLAS_CLIENT_SECRET,
    NYLAS_API_URI:process.env.NYLAS_API_URI,
    NYLAS_REDIRECT_URI:process.env.NYLAS_REDIRECT_URI,   
    GEMINI_API_KEY:process.env.GEMINI_API_KEY
}
 
export default environmentVariables
 