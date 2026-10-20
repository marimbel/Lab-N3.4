# Lab-N3.4
Marianna Belmares, Nico Savaides, Brent Paterson, Alexandra Guttierez

---

# Smart Speech Coach on AWS Elastic Beanstalk

This lab deploys the **same Node/Express + Gemini backend from [Lab N3.3](https://github.com/marimbel/Lab-N3.3)** (which ran on Google Cloud Run) to **AWS Elastic Beanstalk**. The React frontend calls it with `fetch()`. At the end is a comparison of the two platforms.

Based on the starter code at [grewe/SmartSpeechCoach](https://github.com/grewe/SmartSpeechCoach). AWS reference: [Deploying Node.js applications to Elastic Beanstalk](https://docs.aws.amazon.com/elasticbeanstalk/latest/dg/create_deploy_nodejs.html).

```
Browser (React frontend, http://localhost:5173)
   │  fetch GET  /api/health        → "Connected to backend (AWS Elastic Beanstalk)"
   │  fetch POST /api/askanything   → { "message": "..." }
   ▼
AWS Elastic Beanstalk environment
   EC2 instance: nginx (port 80) → Node/Express (PORT 8080, `npm start`)
   │  Gemini API key stored as an Elastic Beanstalk environment property
   ▼
Gemini API → answer → back to the browser
```

---

## Changes made for AWS Elastic Beanstalk (on top of Lab N3.3)

The backend code itself barely changed. It already reads `process.env.PORT`, which is all Elastic Beanstalk needs.

| File | Change | Why |
|---|---|---|
| `backend/Procfile` | **New.** `web: npm start` | Tells Elastic Beanstalk exactly how to start the app. |
| `backend/.platform/nginx/conf.d/timeout.conf` | **New.** Raises nginx's proxy timeouts from 60 s to 180 s | Elastic Beanstalk puts nginx in front of Node. Gemini "thinking" models sometimes take over 60 s, and nginx then returned **504 Gateway Timeout** (the browser shows it as "Could not reach the backend" because nginx's error page has no CORS headers). Cloud Run's default request timeout is 5 minutes, so this never came up there. |
| `backend/.ebignore` | **New.** Excludes `node_modules/`, `.env`, `.env.cloudrun`, `.env.aws` | Keeps secrets and local packages out of the upload. Elastic Beanstalk runs `npm install` on the server itself. |
| `backend/.env.aws.example` | **New.** The environment properties to set on Elastic Beanstalk | Elastic Beanstalk reads config from environment properties instead of a `.env` file. |
| `backend/server.js` | `/api/health` reports `runningOn` from a `DEPLOY_PLATFORM` property (falls back to Cloud Run / local detection) | Cloud Run sets `K_SERVICE` automatically, but Elastic Beanstalk has no equivalent, so we set `DEPLOY_PLATFORM=AWS Elastic Beanstalk` ourselves. The frontend then shows which cloud it's talking to. |
| `frontend/src/App.jsx` | `VITE_SERVER_REMOTE` accepts `AWS` (→ `VITE_SERVER_URL_AWS`) as well as `Y` (Cloud Run) and `N` (local) | Lets us switch the same frontend between the AWS and Google backends to compare them. |
| `frontend/.env.example` | Added `VITE_SERVER_URL_AWS` | Same reason. |
| `.gitignore` | Ignores `backend/.env.aws`, `.elasticbeanstalk/` files, `*.zip` | Keeps secrets and EB CLI local state out of Git. |

Everything from Lab N3.3 is still here, so `gcloud run deploy` from `backend/` still works (see section 5).

---

## 1. Run locally

```
cd backend
npm install
npm start                       # Windows PowerShell: npm.cmd start   → http://localhost:3001
```
```
cd frontend
npm install
npm run dev                     # → http://localhost:5173
```
`backend/.env` and `frontend/.env` work the same as in Lab N3.3. Copy the `.env.example` files and fill them in.

---

## 2. Deploy the backend to AWS Elastic Beanstalk (EB CLI)

### 2.1 One-time setup
1. Sign in to an AWS account. Use an **IAM user**, not the root user, and give it permissions for Elastic Beanstalk, e.g. the `AdministratorAccess-AWSElasticBeanstalk` managed policy. Create an **access key** for it.
2. Install the AWS CLI and the EB CLI:
   ```
   pip install awsebcli            # or: pipx install awsebcli
   eb --version
   ```
3. Store your credentials (`aws configure` if you have the AWS CLI, otherwise `eb init` asks for them).

### 2.2 Initialize the application (run inside `backend/`)
```
cd backend
eb init smart-speech-coach -p node.js --region us-west-2
```
- `-p node.js` picks the latest Node.js platform on Amazon Linux 2023.
- Say **no** to CodeCommit. SSH is optional.
- This creates `backend/.elasticbeanstalk/config.yml` (git-ignored).

### 2.3 Create the environment
```
eb create smart-speech-coach-env --single --instance_type t3.micro
```
- `--single` = one EC2 instance with no load balancer. It's the cheapest option and fine for a class demo.
- This takes about **5–10 minutes**. EB creates the EC2 instance, security group, Auto Scaling group, an S3 bucket for app versions, and IAM roles. It uploads `backend/`, minus everything in `.ebignore`, then runs `npm install` and `npm start`.
- It's normal for the app to report errors until 2.4 is done, because the Gemini key isn't set yet.

### 2.4 Set environment properties (the `.env` values)
Elastic Beanstalk doesn't read `.env` files. Set each value as an environment property (see `backend/.env.aws.example`):

**macOS / Linux / Git Bash**
```
eb setenv \
  GEMINI_API_KEY="your_gemini_api_key" \
  geminiAskAnythingModel="gemini-3.8-flash" \
  allowedOrigins="http://localhost:5173,http://127.0.0.1:5173" \
  DEPLOY_PLATFORM="AWS Elastic Beanstalk" \
  askAnythingPrompt="You are going to answer questions about Smart Speech Coach. Smart Speech Coach is a service that helps people practice speeches, improve delivery, organize ideas, reduce speaking anxiety, and get simple coaching feedback using Machine Learning. If the user asks about something unrelated, briefly steer them back to asking about Smart Speech Coach. Keep the answer to 1-3 sentences."
```
**Windows PowerShell:** same command on one line, or end each line with a backtick `` ` `` instead of `\`.

**Or in the AWS Console:** Elastic Beanstalk → Environments → `smart-speech-coach-env` → **Configuration** → *Updates, monitoring, and logging* → **Environment properties** → add each key/value → **Apply**.

Do **not** set `PORT`. Elastic Beanstalk sets `PORT=8080`, and nginx forwards port 80 to it.

### 2.5 Test the deployed backend
```
eb status        # shows the CNAME, e.g. smart-speech-coach-env.eba-xxxxxxx.us-west-2.elasticbeanstalk.com
eb open          # opens it in a browser → "Smart Speech Coach backend is running..."

curl http://YOUR-EB-CNAME/api/health
# {"status":"ok","service":"smart-speech-coach-backend","runningOn":"AWS Elastic Beanstalk",...}

curl -X POST http://YOUR-EB-CNAME/api/askanything \
  -H "Content-Type: application/json" \
  -d "{\"message\":\"How can Smart Speech Coach help me?\"}"
```

### 2.6 Connect the frontend
In `frontend/.env`:
```
VITE_SERVER_REMOTE=AWS
VITE_SERVER_URL_AWS=http://YOUR-EB-CNAME
```
Then `cd frontend && npm run dev`, open http://localhost:5173, and check that the line under the answer box says **"Connected to backend (AWS Elastic Beanstalk)"**. Ask a question.
Switch `VITE_SERVER_REMOTE=Y` to point the same page at the Cloud Run backend from Lab N3.3.

> **HTTP vs HTTPS:** the default `*.elasticbeanstalk.com` URL is **HTTP only**. That works from `http://localhost:5173`. A frontend served over **HTTPS** (e.g. Firebase Hosting) can't call an HTTP backend, because the browser blocks it as mixed content. For that you'd need a load-balanced environment with an HTTPS listener and an ACM certificate on your own domain, or CloudFront in front. Cloud Run gives you HTTPS automatically.

### 2.7 Redeploy, logs, and clean up
```
eb deploy                        # upload a new version after code changes
eb setenv allowedOrigins="..."   # change config only (restarts the app)
eb logs                          # fetch nginx + app logs (console.log/console.error output)
eb health                        # instance health
eb terminate smart-speech-coach-env   # DELETE the environment when finished so it stops costing money
```

### 2.8 Deploy from the AWS Console (no EB CLI) — this is how we deployed
1. Make a zip whose **root** contains `server.js`, `package.json`, `package-lock.json`, `Procfile` and the `.platform/` folder (the nginx timeout fix). Zip the files, not the `backend` folder, and leave out `node_modules` and `.env`.
   - macOS / Linux: `cd backend && zip -r ../backend-eb.zip server.js package.json package-lock.json Procfile .platform`
   - PowerShell: `cd backend; Compress-Archive -Path server.js,package.json,package-lock.json,Procfile,.platform -DestinationPath ..\backend-eb.zip`
2. Console → **Elastic Beanstalk** → **Create application** → *Web server environment*.
3. Platform: **Node.js** (Amazon Linux 2023). Application code: **Upload your code** → `backend-eb.zip`.
4. Presets: **Single instance (free tier eligible)**.
5. Service access: create or choose the **service role** and an **EC2 instance profile** (e.g. `aws-elasticbeanstalk-ec2-role`).
6. Under *Environment properties* add the keys from section 2.4 → **Submit**, and wait for the health check to go green.

**What actually happened when we did this:** our first attempt failed with *"Environment creation was cancelled because the instance profile could not be created ... The security token included in the request is invalid."* The console could not create the EC2 role automatically. We fixed it by creating the role ourselves first:

1. **IAM → Roles → Create role** → trusted entity **AWS service**, use case **EC2**.
2. Attach `AWSElasticBeanstalkWebTier`, `AWSElasticBeanstalkWorkerTier`, `AWSElasticBeanstalkMulticontainerDocker`.
3. Name it `aws-elasticbeanstalk-ec2-role` → **Create role**.
4. Back in Elastic Beanstalk → **Environments → Create environment**, and on *Configure service access* pick that role as the **EC2 instance profile**.

The environment then launched on **Node.js 24 running on 64bit Amazon Linux 2023**. On Google Cloud Run (Lab N3.3) there was no equivalent step: `gcloud run deploy` set up everything it needed.

### 2.9 Troubleshooting
| Symptom | Likely cause / fix |
|---|---|
| Health "Severe", page shows **502 Bad Gateway** | The Node app crashed or isn't listening on `PORT`. Run `eb logs` and look at `web.stdout.log`. |
| "Smart Speech Coach could not answer right now." and the logs show `404 ... models/gemini-2.5-flash is no longer available to new users` | Google retired that model for new API keys. We changed `geminiAskAnythingModel` to `gemini-3.8-flash` (environment property + all `.env` examples). |
| Logs: `Model 'http://localhost:5173,...' not found` | The `geminiAskAnythingModel` and `allowedOrigins` values were swapped in the console. Fix the environment properties. |
| Frontend: "Could not reach the backend", nginx `access.log` shows **504**, `error.log` shows `upstream timed out` | Gemini took > 60 s. Deploy a zip that includes `.platform/` (the timeout config above). |
| `Gemini API key is not configured` | `GEMINI_API_KEY` property is missing (2.4). |
| Frontend: "Cannot reach backend", CORS error in console | Add your frontend origin to `allowedOrigins` with `eb setenv`. |
| Frontend on HTTPS can't reach backend | Mixed content: see the HTTP vs HTTPS note in 2.6. |
| `eb create` fails about an instance profile / role | Create `aws-elasticbeanstalk-ec2-role` in the console (2.8 step 5) or pass `--instance_profile`. |
| Uploaded the wrong files | With `.ebignore` present, `eb deploy` uploads the `backend/` folder as it is on disk (not the last Git commit), minus ignored files. |

### 2.10 Our deployment
| | |
|---|---|
| Method | AWS Console upload of `backend-eb.zip` (section 2.8) |
| AWS region | `us-east-2` (Ohio) |
| Application / environment | `smart-speech-coach` / `Smart-speech-coach-env` |
| Platform | Node.js 24 running on 64bit Amazon Linux 2023 (single instance, free-tier preset) |
| Backend URL | `http://smart-speech-coach-env.eba-xxxxxxx.us-east-2.elasticbeanstalk.com` |
| Health check | `http://smart-speech-coach-env.eba-xxxxxxx.us-east-2.elasticbeanstalk.com/api/health` → `"runningOn":"AWS Elastic Beanstalk"` |
| Frontend | run locally (`npm run dev`, http://localhost:5173) with `VITE_SERVER_REMOTE=AWS` |
| Deployed by / date | Marianna Belmares, 2026-10-15 |

### 2.11 Demo steps (10/15 check)
1. Show the environment in the Elastic Beanstalk console: Health **Ok**, Domain, Events log, **Configuration → Environment properties** (key hidden).
2. Open `http://<domain>/api/health` → `"runningOn":"AWS Elastic Beanstalk"`.
3. `cd frontend && npm run dev` → http://localhost:5173 shows **"Connected to backend (AWS Elastic Beanstalk)"** → ask a question and get a Gemini answer.
4. Change `VITE_SERVER_REMOTE=Y` in `frontend/.env`, restart `npm run dev` → the same page now talks to the Cloud Run backend from Lab N3.3.
5. Stop it: **Actions → Terminate environment** (or `eb terminate`). Refresh the domain to show it is gone.

## 3. Comparison: Google Cloud Run vs. AWS Elastic Beanstalk

| | **Google Cloud Run** (Lab N3.3) | **AWS Elastic Beanstalk** (Lab N3.4) |
|---|---|---|
| What it is | Serverless **containers**. Google runs the container; there are no servers to see. | Managed **EC2 virtual machines**. EB provisions the instance, nginx, security group, Auto Scaling group and S3 bucket for you, and you can see and change all of them. |
| Deploy command | `gcloud run deploy --source .` (one command) | `eb init` + `eb create` (first time), then `eb deploy` |
| How code is packaged | Source → Cloud Build + buildpack → container image in Artifact Registry | Source zip → S3 → unzipped on the EC2 instance → `npm install` → `npm start` |
| First deploy time | A couple of minutes | ~5–10 minutes to create the environment; updates are faster |
| Config / secrets | `--env-vars-file .env.cloudrun` (YAML) or Secret Manager | `eb setenv` / console **Environment properties** (or Secrets Manager / Parameter Store) |
| Port | Sets `PORT` (8080) | Sets `PORT` (8080); nginx proxies port 80 → app |
| URL | `https://…run.app`: **HTTPS by default** | `http://….elasticbeanstalk.com`: **HTTP by default**; HTTPS needs a load balancer + certificate |
| Scaling | Automatic per request, **scales to zero** when idle | Auto Scaling group of EC2 instances; at least one instance is always running |
| Cost model | Pay only while handling requests (generous free tier) | Pay for EC2 instance hours (plus load balancer if used) **even when idle**. Run `eb terminate` when done. |
| Cold starts | Possible after idle (scale-to-zero) | None, because the instance is always on |
| Control | Less: no OS access | More: SSH into the instance, choose instance type, customize with `.ebextensions` / `.platform` hooks |
| Logs | `gcloud run services logs read` / Cloud Logging | `eb logs` / CloudWatch (optional) |
| Code changes needed | None (already used `PORT`) | Added `Procfile` and `.ebignore`, and set `DEPLOY_PLATFORM` |
| Permissions setup | Enabling the APIs was enough; Cloud Run used the default service account | Needed a **service role** and an **EC2 instance profile** (IAM role). The console failed to create it for us, so we had to create it in IAM first |
| Stopping | Delete the service (+ images in Artifact Registry); idle services already cost ~$0 | **Terminate** the environment; otherwise the EC2 instance keeps running and using credits |

**Takeaways:**
- Cloud Run was simpler and faster to deploy. It gave HTTPS automatically and costs nothing while idle, which suits a small, bursty API like this one.
- Elastic Beanstalk takes more setup (IAM, roles, environment creation) and keeps a server running all the time. In return it gives full control over the VM and no cold starts, so it fits apps that need a persistent server or OS-level customization.
- Our Express app ran on both with almost no code changes, because it reads its port and settings from environment variables.

---

## 4. Environment files summary (never commit the real ones)

| File | Used for |
|---|---|
| `backend/.env` | local backend (`KEY=value`) |
| `backend/.env.cloudrun` | Cloud Run `--env-vars-file` (YAML `KEY: "value"`) |
| `backend/.env.aws` *(optional, for your reference)* | values to paste into `eb setenv` / the EB console |
| `frontend/.env` | `VITE_SERVER_REMOTE` = `AWS` / `Y` / `N` and the matching URLs |

## 5. Google Cloud Run (from Lab N3.3)
```
cd backend
gcloud run deploy smart-speech-coach-backend --source . --region us-west1 --allow-unauthenticated --env-vars-file .env.cloudrun
```
Full step-by-step instructions are in the [Lab N3.3 README](https://github.com/marimbel/Lab-N3.3#3-how-we-deployed-the-backend-to-google-cloud-run).
