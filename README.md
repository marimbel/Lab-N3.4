# Lab-N3.3
Marianna Belmares, Nico Savaides, Brent Paterson, Alexandra Guttierez

---

# Smart Speech Coach: AI-Enabled Full-Stack Web App

A React (Vite) **frontend** that uses JavaScript `fetch()` to call a **Node/Express backend**.
The backend calls the **Gemini API**. It is deployed to **Google Cloud Run**.

Based on the starter code at [grewe/SmartSpeechCoach](https://github.com/grewe/SmartSpeechCoach).

```
Browser (React frontend)
   │  fetch GET  /api/health        → shows "Connected to backend (Google Cloud Run)"
   │  fetch POST /api/askanything   → { "message": "..." }
   ▼
Node/Express backend on Google Cloud Run
   │  Gemini API key stays here, never in the browser
   ▼
Gemini API → answer text → back to the browser
```

## What we changed from the starter code

| File | Change |
|---|---|
| `frontend/src/App.jsx` | When the page loads, `fetch()` calls `GET /api/health` and shows whether the frontend reached the backend, and whether that backend is local or on **Google Cloud Run**. The page also gives clearer errors when the backend can't be reached (wrong URL, server down, CORS) or returns something that isn't JSON. |
| `frontend/src/App.css` | Styles for the backend status line. |
| `backend/server.js` | `/api/health` now also returns `runningOn` (Cloud Run sets `K_SERVICE` automatically). Added `GET /` so the bare Cloud Run URL shows a friendly message. |
| `backend/package.json` | Pinned dependency versions instead of `latest`, so a Cloud Run build can't pull a breaking release. Added `engines.node >= 20`. |
| `backend/.gcloudignore` | Keeps `.env`, `.env.cloudrun` and `node_modules` out of the upload to Google Cloud. |
| `backend/.env.cloudrun.example` | Renamed from the misspelled `.env.coudrun.example`. |

## Project layout

```
backend/   Node/Express API (server.js) → deployed to Google Cloud Run
frontend/  React + Vite client that calls the backend with fetch()
```

---

## 1. Environment files (never commit the real ones)

Copy each example file and fill in your values. The real files are already in `.gitignore`.

| File | Used for | Format |
|---|---|---|
| `backend/.env` | running the backend locally | `KEY=value` |
| `backend/.env.cloudrun` | Cloud Run deploy (`--env-vars-file`) | **YAML**: `KEY: "value"` |
| `frontend/.env` | which backend URL the frontend calls | `KEY=value` |

`backend/.env.cloudrun` example (YAML; **do not** include `PORT`, because Cloud Run sets it itself):
```yaml
GEMINI_API_KEY: "your_gemini_api_key"
geminiAskAnythingModel: "gemini-2.5-flash"
askAnythingPrompt: "You are going to answer questions about Smart Speech Coach. ... Keep the answer to 1-3 sentences."
allowedOrigins: "http://localhost:5173,http://127.0.0.1:5173"
```

`frontend/.env`:
```
VITE_SERVER_REMOTE=Y
VITE_SERVER_URL_REMOTE=https://YOUR-CLOUD-RUN-URL
VITE_SERVER_URL_LOCAL=http://localhost:3001
```
`VITE_SERVER_REMOTE=Y` calls the Cloud Run backend; `N` calls the local one. Restart `npm run dev` after editing `.env`.

Get a Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey).

---

## 2. Run locally

Backend (terminal 1):
```
cd backend
npm install
npm start                # Windows PowerShell: npm.cmd start
# check: http://localhost:3001/api/health  →  {"status":"ok", ...}
```

Frontend (terminal 2):
```
cd frontend
npm install
npm run dev              # Windows PowerShell: npm.cmd run dev
# open http://localhost:5173
```

---

## 3. How we deployed the backend to Google Cloud Run

### 3.1 One-time setup
1. Install the [Google Cloud CLI](https://cloud.google.com/sdk/docs/install) (`gcloud`).
2. Log in and pick the project (billing must be enabled on it):
   ```
   gcloud auth login
   gcloud projects list
   gcloud config set project YOUR_PROJECT_ID
   ```
3. Enable the services Cloud Run needs to build from source:
   ```
   gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com
   ```

### 3.2 Create `backend/.env.cloudrun`
Copy `backend/.env.cloudrun.example` to `backend/.env.cloudrun` and fill it in using the YAML format from section 1.
`allowedOrigins` must list every site the frontend will be opened from (for example `http://localhost:5173`, and the Firebase URL if you host the frontend there).

### 3.3 Deploy
```
cd backend
gcloud run deploy smart-speech-coach-backend \
  --source . \
  --region us-west1 \
  --allow-unauthenticated \
  --env-vars-file .env.cloudrun
```
(Windows PowerShell: put it on one line, or replace each `\` with a backtick `` ` ``.)

- `--source .` uploads the `backend/` folder. Cloud Build packages it with Google's Node.js buildpack, which runs `npm start`, so no Dockerfile is needed.
- If it asks to create an Artifact Registry repository, answer **Y**.
- When it finishes it prints a **Service URL** like `https://smart-speech-coach-backend-xxxxxxxxxx.us-west1.run.app`.

### 3.4 Test the deployed backend
```
curl https://YOUR-CLOUD-RUN-URL/api/health
# {"status":"ok","service":"smart-speech-coach-backend","runningOn":"Google Cloud Run",...}

curl -X POST https://YOUR-CLOUD-RUN-URL/api/askanything \
  -H "Content-Type: application/json" \
  -d "{\"message\":\"How can Smart Speech Coach help me?\"}"
```

### 3.5 Point the frontend at Cloud Run
1. In `frontend/.env`, set `VITE_SERVER_REMOTE=Y` and `VITE_SERVER_URL_REMOTE=` the Service URL (no trailing `/`).
2. `cd frontend && npm run dev`, then open http://localhost:5173.
3. The line under the answer box should read **"Connected to backend (Google Cloud Run): https://…run.app"**. Ask a question; the answer comes from Gemini through the Cloud Run backend.

### 3.6 Redeploying after changes
Run the same `gcloud run deploy` command from 3.3 again. It creates a new revision at the same URL.
To change only an environment variable (for example to add an origin to `allowedOrigins`):
```
gcloud run services update smart-speech-coach-backend --region us-west1 --env-vars-file .env.cloudrun
```

### 3.7 Logs and troubleshooting
```
gcloud run services logs read smart-speech-coach-backend --region us-west1 --limit 50
```
| Symptom | Likely cause |
|---|---|
| Status line says "Cannot reach backend", and the browser console shows a CORS error | The frontend's origin (e.g. `http://localhost:5173`) is missing from `allowedOrigins`. Update and redeploy (3.6). |
| `Gemini API key is not configured` | `GEMINI_API_KEY` is missing from `.env.cloudrun`. |
| "Smart Speech Coach could not answer right now." | Gemini call failed (bad key or bad model name). Check the logs. |
| Deploy fails mentioning `PORT` | Remove `PORT`/`port` from `.env.cloudrun`; Cloud Run sets it. |
| Frontend still calls the old URL | Restart `npm run dev`, or rebuild with `npm run build`, after editing `frontend/.env`. |

> Note: `--env-vars-file` stores the API key as a plain environment variable on the service. For a production app, store it in [Secret Manager](https://cloud.google.com/run/docs/configuring/services/secrets) and use `--set-secrets` instead.

### 3.8 Our deployment
| | |
|---|---|
| Google Cloud project | `YOUR_PROJECT_ID` |
| Service name / region | `smart-speech-coach-backend` / `us-west1` |
| Service URL | `https://YOUR-CLOUD-RUN-URL` |
| Deployed by / date | |

---

## 4. (Optional) Host the frontend on Firebase
```
cd frontend
npm run build
cd ..
firebase deploy --only hosting
```
Edit `.firebaserc` to use your own Firebase project, and add the Firebase URL (e.g. `https://YOUR-APP.web.app`) to `allowedOrigins` in `backend/.env.cloudrun`, then redeploy the backend.
