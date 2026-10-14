import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { GoogleGenAI } from '@google/genai';

// Create the Express application. Express handles our backend routes.
const app = express();

// Use Cloud Run's PORT value when deployed, or the port value from backend/.env locally.
// If neither is set, the backend runs on port 3001.
const port = process.env.PORT || 3001;

// Read allowedOrigins from backend/.env as a comma-separated list.
// Example: allowedOrigins=http://localhost:5173,http://127.0.0.1:5173
const allowedOrigins = process.env.allowedOrigins
  ? process.env.allowedOrigins.split(',').map((origin) => origin.trim())
  : ['http://localhost:5173', 'http://127.0.0.1:5173'];

// Enable CORS (Cross-Origin Resource Sharing - front-end and backend on different servers) only for the frontend URLs in allowedOrigins.
// This includes local development and the deployed Firebase frontend.
app.use(cors({ origin: allowedOrigins }));

// Tell Express to parse incoming JSON request bodies.
// This lets us read request.body.message in the /api/askanything route.
app.use(express.json());

// Create the Gemini API client.
// The API key is loaded from backend/.env through dotenv.
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// The Ask Anything prompt is loaded from backend/.env.
// Keeping it in .env lets us change the agent instructions without editing code.
const askAnythingPrompt = process.env.askAnythingPrompt;

// The Gemini model for Ask Anything is also loaded from backend/.env.
const geminiAskAnythingModel = process.env.geminiAskAnythingModel;

// A small test route. If this returns { status: "ok" },
// the backend server is running correctly.
// The frontend calls this route with fetch() when the page loads to show
// whether it is connected to the backend (local or Cloud Run).
app.get('/api/health', (request, response) => {
  response.json({
    status: 'ok',
    service: 'smart-speech-coach-backend',
    // K_SERVICE is set automatically by Google Cloud Run, so the frontend
    // can tell whether it is talking to the deployed service or a local server.
    runningOn: process.env.K_SERVICE ? 'Google Cloud Run' : 'local',
    time: new Date().toISOString(),
  });
});

// Visiting the bare Cloud Run URL in a browser shows this instead of "Cannot GET /".
app.get('/', (request, response) => {
  response.send('Smart Speech Coach backend is running. Try GET /api/health or POST /api/askanything.');
});

// Ask Anything endpoint
// This route receives a user's question from the frontend,
// sends it to Gemini, and returns Gemini's answer.
app.post('/api/askanything', async (request, response) => {
  // Pull the message out of the JSON request body and remove extra spaces.
  const message = request.body?.message?.trim();

  // Stop early if the user submitted an empty message.
  if (!message) {
    return response.status(400).json({
      error: 'Please enter a question.',
    });
  }

  // Stop early if the Gemini key has not been configured.
  // The real key should live only in backend/.env.
  if (!process.env.GEMINI_API_KEY) {
    return response.status(500).json({
      error: 'Gemini API key is not configured.',
    });
  }

  // Stop early if the Ask Anything prompt has not been configured.
  // The prompt should live in backend/.env as askAnythingPrompt.
  if (!askAnythingPrompt) {
    return response.status(500).json({
      error: 'Ask Anything prompt is not configured.',
    });
  }

  // Stop early if the Gemini model name has not been configured.
  // The model should live in backend/.env as geminiAskAnythingModel.
  if (!geminiAskAnythingModel) {
    return response.status(500).json({
      error: 'Ask Anything Gemini model is not configured.',
    });
  }

  try {
    // Combine the configured agent instructions with the user's actual question.
    const prompt = `${askAnythingPrompt}

User question: ${message}`;

    // Ask Gemini for a response using the Interactions API.
    const interaction = await ai.interactions.create({
      model: geminiAskAnythingModel,
      input: prompt,
    });

    // Send only the final answer text back to the frontend.
    response.json({
      answer: interaction.output_text,
    });
  } catch (error) {
    // Log the real error for the developer, but send the user
    // a simple message that does not expose internal details.
    console.error('Gemini request failed:', error);
    response.status(500).json({
      error: 'Smart Speech Coach could not answer right now.',
    });
  }
});

// Start the backend and print the local URL in the terminal.
app.listen(port, () => {
  console.log(`Smart Speech Coach backend running on http://localhost:${port}`);
});
