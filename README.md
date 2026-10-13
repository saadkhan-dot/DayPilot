# DayPilot MVP

DayPilot is a local, single-user task planner. It is not production-ready for multiple users: authentication and per-user data isolation are intentionally outside this MVP.

## Requirements and setup

- Node.js 18+ (the AI integration uses built-in `fetch`)
- MongoDB running locally or a MongoDB URI

```sh
npm install
cp .env.example .env
# Set MONGODB_URI in .env if your MongoDB is not at the default address.
npm run dev
```

The API listens on port 3000 by default. `GET /api/health` checks that the HTTP app is up; startup itself requires a working MongoDB connection. Core task and habit endpoints work without an AI key. Configure `OPENAI_API_KEY` to enable `/api/ai/plan`; without it, the route returns HTTP 503 and explains the missing configuration. In a second terminal, run `npm run dev:frontend`; Vite serves the React dashboard at `http://localhost:5173` and proxies `/api` requests to the backend.

Calendar date strings use UTC (`YYYY-MM-DD`). Due dates and daily progress are grouped by UTC midnight. Habit completion records are attached to one exact date string.

## Thunder Client examples

Set `{{baseUrl}}` to `http://localhost:3000`.

```http
POST {{baseUrl}}/api/tasks
Content-Type: application/json

{"title":"Write project outline","description":"First draft","priority":"high","dueDate":"2026-10-13"}
```

```http
GET {{baseUrl}}/api/tasks?date=2026-10-13
PATCH {{baseUrl}}/api/tasks/{{taskId}}
Content-Type: application/json

{"completed":true}
```

```http
POST {{baseUrl}}/api/habits
Content-Type: application/json

{"name":"Walk","description":"Take a short walk"}
```

```http
PUT {{baseUrl}}/api/habits/{{habitId}}/completions/2026-10-13
GET {{baseUrl}}/api/habits/{{habitId}}/completions?from=2026-10-01&to=2026-10-31
GET {{baseUrl}}/api/progress?date=2026-10-13
```

```http
POST {{baseUrl}}/api/ai/plan
Content-Type: application/json

{"goals":"Prepare for my product review and keep time for lunch","date":"2026-10-13","availableMinutes":240,"priorities":"Product review is most important"}
```

Review the returned `data.plan.tasks`, then approve by its ID:

```http
POST {{baseUrl}}/api/ai/plan/{{planId}}/approve
```

Approval can be repeated safely; the response includes `alreadyApproved` and the same task records.

## Stages and architecture

- `app.js` composes routes and error handling; `server.js` loads config, connects MongoDB, and starts Express.
- Routes forward to controllers. Controllers validate HTTP input and return a consistent JSON envelope. Mongoose models define persistence constraints.
- `services/progressService.js` computes progress deterministically; no LLM is involved.
- `services/aiService.js` owns provider integration and a five-iteration tool loop. The only tools are `getTasks`, `getHabits`, `getDailyProgress`, and `proposeTasks`. Tool names and JSON arguments are checked, task proposals have count/time bounds, and the model cannot mutate the database. A pending plan is persisted only after validation. The approval endpoint creates tasks using a unique `(planId, planIndex)` key, making retries idempotent.
- The AI uses the OpenAI Chat Completions tool-calling API. Only `OPENAI_API_KEY` and optional `OPENAI_MODEL` configure it; secrets stay out of the client response.

## Testing

Run `npm test` for automated tests. Integration coverage uses a real local MongoDB, so start MongoDB first. Core AI validation and mocked agent tests do not need an API key or network access.
