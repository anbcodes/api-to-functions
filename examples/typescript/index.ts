/* A typescript type checking example This is NOT a working example */
import ApiToFunctions from '@anbcodes/api-to-functions'

interface RemoteAPI {
  exampleFunction: (data: string) => Promise<string>
}

const placeholderFunction = () => ''

const apiCreator = new ApiToFunctions<RemoteAPI>(placeholderFunction, placeholderFunction)

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const remoteApi = apiCreator.remoteFunctions

// remoteApi now has the type of RemoteAPI for things like autocompletion