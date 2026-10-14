import { useEffect, useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from './assets/vite.svg'
import speechCoachLogo from './assets/speech-coach-logo.jpg'
import './App.css'
import NavigationBar from "./components/NavigationBar";

function App() {
  // message stores what the user is currently typing in the input box.
  const [message, setMessage] = useState('')

  // answer stores the text that appears in the answer box below the input.
  const [answer, setAnswer] = useState('')

  // isLoading tracks whether the frontend is waiting for the backend/Gemini.
  const [isLoading, setIsLoading] = useState(false)

  // Read the backend server settings from frontend/.env.
  // Vite exposes frontend environment variables that start with VITE_.
  const serverRemote = import.meta.env.VITE_SERVER_REMOTE
  const serverUrl =
    serverRemote === 'Y'
      ? import.meta.env.VITE_SERVER_URL_REMOTE
      : import.meta.env.VITE_SERVER_URL_LOCAL

  // backendStatus describes whether the frontend can reach the backend.
  // It is filled in by the /api/health fetch below.
  // If no backend URL is configured, show that right away instead of checking.
  const [backendStatus, setBackendStatus] = useState(
    serverUrl
      ? { state: 'checking', text: 'Checking backend connection...' }
      : {
          state: 'error',
          text: 'No backend URL set. Add VITE_SERVER_URL_REMOTE / VITE_SERVER_URL_LOCAL to frontend/.env.',
        }
  )

  // When the page first loads, call the backend's /api/health route with fetch().
  // This proves the browser can reach the backend (e.g. the Google Cloud Run service)
  // before the user even asks a question.
  useEffect(() => {
    if (!serverUrl) return

    async function checkBackend() {
      try {
        const response = await fetch(`${serverUrl}/api/health`)
        const data = await response.json()
        if (!response.ok || data.status !== 'ok') {
          throw new Error('Backend responded but is not healthy.')
        }
        setBackendStatus({
          state: 'ok',
          text: `Connected to backend (${data.runningOn || 'unknown'}): ${serverUrl}`,
        })
      } catch {
        setBackendStatus({
          state: 'error',
          text: `Cannot reach backend at ${serverUrl}. Is it running, and is this site in allowedOrigins (CORS)?`,
        })
      }
    }

    checkBackend()
  }, [serverUrl])


  // This function runs when the user presses Enter in the form.
  async function handleSubmit(event) {
    // Stop the browser from refreshing the page when the form submits.
    event.preventDefault()

    // Remove extra spaces before checking or sending the question.
    const question = message.trim()

    // Do not call the backend if the input is empty.
    if (!question) {
      setAnswer('Please type a question first.')
      return
    }

    // Show immediate feedback while the backend asks Gemini for an answer.
    setIsLoading(true)
    setAnswer('Thinking...')

    try {
      // Send the user's question to the backend.
      // The backend keeps the Gemini API key private and calls Gemini for us.
      // Use the port value from backend/.env when it exists.
     
      const response = await fetch(`${serverUrl}/api/askanything`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: question }),
      })

      // Read the JSON response from the backend.
      // If the backend sent back something that is not JSON (e.g. an HTML error page),
      // fall back to an empty object so we can still show a useful error.
      const data = await response.json().catch(() => ({}))

      // If the backend returned an error status, show that error to the user.
      if (!response.ok) {
        throw new Error(data.error || 'Unable to get an answer right now.')
      }

      // Display Gemini's answer in the answer box.
      setAnswer(data.answer)
    } catch (error) {
      // If the request fails, display a simple error message in the answer box.
      // "Failed to fetch" means the browser never got a response (wrong URL, backend down, or CORS).
      setAnswer(
        error.message === 'Failed to fetch'
          ? `Could not reach the backend at ${serverUrl}.`
          : error.message
      )
    } finally {
      // Re-enable the input whether the request succeeded or failed.
      setIsLoading(false)
    }
  }

  return (
    <>
     <NavigationBar />
      <section id="center">
        <div className="hero">
          <img
            src={speechCoachLogo}
            className="hero-image"
            alt="AI coach helping a speaker at a podium"
          />
        </div>
        <div>
          <h1>Ask me anything</h1>
        </div>
        <form className="question-form" onSubmit={handleSubmit}>
          <input
            className="question-input"
            type="text"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Type your question"
            aria-label="Type your question"
            disabled={isLoading}
          />
        </form>
        <div className="answer-box" aria-live="polite">
          {answer}
        </div>
        <p className={`backend-status backend-status-${backendStatus.state}`}>
          {backendStatus.text}
        </p>
      </section>

      <div className="ticks"></div>

      <section id="next-steps">
        <div id="docs">
          <svg className="icon" role="presentation" aria-hidden="true">
            <use href="/icons.svg#documentation-icon"></use>
          </svg>
          <h2>Documentation</h2>
          <p>Your questions, answered</p>
          <ul>
            <li>
              <a href="https://vite.dev/" target="_blank">
                <img className="logo" src={viteLogo} alt="" />
                Explore SSC
              </a>
            </li>
            <li>
              <a href="https://react.dev/" target="_blank">
                <img className="button-icon" src={reactLogo} alt="" />
                Learn more
              </a>
            </li>
          </ul>
        </div>
        <div id="social">
          <svg className="icon" role="presentation" aria-hidden="true">
            <use href="/icons.svg#social-icon"></use>
          </svg>
          <h2>Connect with us</h2>
          <p>Join the SSC community</p>
          <ul>
            <li>
              <a href="https://github.com/vitejs/vite" target="_blank">
                <svg
                  className="button-icon"
                  role="presentation"
                  aria-hidden="true"
                >
                  <use href="/icons.svg#github-icon"></use>
                </svg>
                GitHub
              </a>
            </li>
            <li>
              <a href="https://chat.vite.dev/" target="_blank">
                <svg
                  className="button-icon"
                  role="presentation"
                  aria-hidden="true"
                >
                  <use href="/icons.svg#discord-icon"></use>
                </svg>
                Discord
              </a>
            </li>
            <li>
              <a href="https://x.com/vite_js" target="_blank">
                <svg
                  className="button-icon"
                  role="presentation"
                  aria-hidden="true"
                >
                  <use href="/icons.svg#x-icon"></use>
                </svg>
                X.com
              </a>
            </li>
            <li>
              <a href="https://bsky.app/profile/vite.dev" target="_blank">
                <svg
                  className="button-icon"
                  role="presentation"
                  aria-hidden="true"
                >
                  <use href="/icons.svg#bluesky-icon"></use>
                </svg>
                Bluesky
              </a>
            </li>
          </ul>
        </div>
      </section>

      <div className="ticks"></div>
      <section id="spacer"></section>
    </>
  )
}

export default App
