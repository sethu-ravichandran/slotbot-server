import Nylas from 'nylas'
import environmentVariables from './envConfig.js'

const nylasConfig = {
  clientId: environmentVariables.NYLAS_CLIENT_ID,
  apiKey: environmentVariables.NYLAS_CLIENT_SECRET,
  redirectUri: environmentVariables.NYLAS_REDIRECT_URI,
  apiUri: environmentVariables.NYLAS_API_URI
}

const nylas = new Nylas(nylasConfig)

export default nylas
export { nylasConfig }
