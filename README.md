# Typeform Clone

A full-stack, Typeform-inspired form builder. Creators can build and publish conversational forms; respondents complete one question at a time; responses are persisted and summarized in a results dashboard.

## Tech stack

- **Frontend:** Next.js 15, React 19, TypeScript, CSS modules/global CSS
- **Backend:** FastAPI, Pydantic, SQLAlchemy
- **Database:** SQLite
- **Uploads:** Local filesystem storage under `backend/data/uploads/`

## Setup

### Prerequisites

- Node.js 20+
- Python 3.11+

### 1. Start the API

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

The API is available at `http://127.0.0.1:8000`; interactive documentation is at `http://127.0.0.1:8000/docs`.

### 2. Start the frontend

Open a second terminal at the repository root:

```powershell
npm install
npm run dev
```

Open `http://localhost:3000`.

The frontend uses `http://127.0.0.1:8000` by default. To use a different API origin, set `NEXT_PUBLIC_API_BASE_URL` before starting Next.js.

### Verification

```powershell
# Repository root
npm run typecheck
npm run build

# Backend directory
py -m pytest tests -q
```

## Architecture overview

```text
Next.js / React client
  ├─ Dashboard: form lifecycle and sharing
  ├─ Builder: questions, design settings, preview, publication
  ├─ Public flow: /f/[slug], one question at a time
  └─ Results: summaries, response details, CSV export
             │ HTTP / JSON
             ▼
FastAPI API
  ├─ form, question, publishing, response, and results endpoints
  ├─ server-side answer validation
  ├─ partial-response and upload endpoints
  └─ seed and lightweight SQLite schema migration at startup
             │
             ▼
SQLite: backend/data/typeform.db
Local uploads: backend/data/uploads/
```

The browser never writes form definitions or submissions directly to local storage. The API is the source of truth. The public route only exposes forms whose status is `published`; creator routes can load draft forms for editing and preview.

## Database schema

| Table | Purpose | Important relationships / constraints |
|---|---|---|
| `forms` | Form identity, public slug, publication status, theme/appearance, thank-you content, timestamps | Unique indexed `slug`; one-to-many to questions and responses |
| `questions` | Ordered question definition, type, title, description, required flag, JSON settings | `form_id → forms`; unique `(form_id, position)` |
| `question_options` | Ordered options for choice/dropdown questions | `question_id → questions`; unique `(question_id, position)` |
| `responses` | A completed submission and submission timestamp | `form_id → forms`; one-to-many to answers |
| `answers` | JSON answer values for individual response/question pairs | `response_id → responses`, `question_id → questions`; unique `(response_id, question_id)` |
| `partial_responses` | Saved in-progress answers and start/update times | `form_id → forms` |
| `uploaded_files` | Metadata for locally stored uploads | `form_id → forms`; unique generated storage name |

Deletes cascade from forms to their questions and responses. Question deletes retain the form and remove answer rows for that deleted question so an edited form remains usable.

## Seed data

At startup, the API creates schema tables, applies the small compatibility migration, and ensures these examples exist without overwriting other forms:

- **Product feedback** — published; short text, email, rating, multiple-choice, and long-text questions; two responses.
- **Community meetup RSVP** — published; short text, dropdown, yes/no, and number questions.

## Assumptions and scope

- A default creator is assumed; authentication, authorization, teams, and invitations are intentionally simplified.
- Forms are single-workspace and single-owner for this implementation.
- SQLite and local upload storage are appropriate for local development/demo use, not multi-instance production deployment.
- The public respondent experience supports the implemented question types and server-side validation. Payment, advanced branching/logic, integrations/webhooks, and team collaboration remain intentionally scoped as future work or UI placeholders where applicable.
- CORS permits the local Next.js development origins (`localhost:3000` and `127.0.0.1:3000`). Update this configuration before deployment.
