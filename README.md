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
npm test
npm run typecheck
npm run build

# Backend directory
py -m pytest tests -q
```

## Frontend tests

The frontend test suite is stored in `src/test/` and runs with Vitest and React Testing Library:

- `components.unit.test.tsx` covers reusable builder and shared UI components.
- `respondent.unit.test.tsx` covers respondent answer controls and form preview behavior.
- `respondent.integration.test.tsx` covers validation, branching, partial saves, submission, and error handling.
- `builder-dashboard.integration.test.tsx` covers creator builder and dashboard workflows.
- `results.integration.test.tsx` covers response summaries, detail views, and empty states.

Run `npm test` once, or use `npm run test:watch` while developing.

## Backend tests

The Python/FastAPI test suite is stored in `backend/tests/` and uses pytest with FastAPI's test client:

- `test_builder_api.py` covers seeded data, form and question CRUD, persistence, publication, reordering, logic jumps, uploads, and deletion/reindexing.
- `test_public_and_results_api.py` covers public-form privacy, answer validation, partial-response completion tracking, duplication, response pagination, summaries, and CSV export.
- `conftest.py` creates a temporary SQLite database and upload directory for every test, keeping `backend/data/typeform.db` and real uploads untouched.

Run the suite from the backend directory:

```powershell
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

```text
forms 1 ──< questions 1 ──< question_options
  │             │
  │             └──< answers >── 1 responses
  │                                  │
  ├──< responses ────────────────────┘
  ├──< partial_responses
  └──< uploaded_files
```

| Table | Main columns | Relationships and constraints |
|---|---|---|
| `forms` | `id`, `title`, unique `slug`, `status`, `theme`, JSON `appearance`, thank-you title/message, timestamps | Parent record for questions, completed responses, partial responses, and uploaded files. `status` is `draft` or `published`; only published forms are available through the public route. |
| `questions` | `id`, `form_id`, `position`, `type`, `title`, `description`, `required`, JSON `settings` | Belongs to a form. Unique `(form_id, position)` preserves the builder’s question order. `type` is one of short text, long text, multiple choice, dropdown, email, number, yes/no, rating, or file upload. |
| `question_options` | `id`, `question_id`, `position`, `label` | Belongs to a choice or dropdown question. Unique `(question_id, position)` preserves option order. |
| `responses` | `id`, `form_id`, `submitted_at` | A completed respondent submission belonging to one form. Has many answer rows. |
| `answers` | `id`, `response_id`, `question_id`, JSON `value` | One persisted answer per submitted question. Unique `(response_id, question_id)` prevents duplicate answers in a response. |
| `partial_responses` | `id`, `form_id`, JSON `answers`, `started_at`, `updated_at` | Stores in-progress respondent answers for completion-rate tracking. |
| `uploaded_files` | `id`, `form_id`, `original_name`, unique `stored_name`, `content_type`, `size_bytes`, `created_at` | Stores metadata only. File bytes live in `backend/data/uploads/`; the response answer stores the uploaded file reference. |

### JSON fields

- `forms.appearance`: optional respondent customizations such as `background`, `accent`, and `font` (`sans`, `serif`, or `mono`).
- `questions.settings`: question-specific configuration. Examples include `placeholder`, `min`/`max`, `ratingSteps`, rating labels, `allowOther`, and basic choice-to-question logic-jump mappings.
- `answers.value`: a string, number, boolean, array, or uploaded-file reference depending on the question type.
- `partial_responses.answers`: an object keyed by question ID, using the same answer-value representation as completed responses.

Form deletion cascades to its questions, responses, partial responses, and file metadata. Question deletion keeps the form intact and removes answer rows only for that deleted question, so a creator can continue editing a form with historic responses.

## Seed data

At startup, the API creates schema tables, applies the small compatibility migration, and ensures these examples exist without overwriting other forms:

- **Product feedback** — published; short text, email, rating, multiple-choice, and long-text questions; includes two completed responses.
- **Community meetup RSVP** — published; short text, dropdown, yes/no, and number questions; ready to receive public responses.

The seeder is idempotent: it checks for each sample title before creating it, so startup does not overwrite creator-created forms. The implementation is in `backend/app/seed.py`, and it runs from the FastAPI lifespan startup hook in `backend/app/main.py`.

## Assumptions and scope

- A default creator is assumed; authentication, authorization, teams, and invitations are intentionally simplified.
- Forms are single-workspace and single-owner for this implementation.
- SQLite and local upload storage are appropriate for local development/demo use, not multi-instance production deployment.
- The public respondent experience supports the implemented question types and server-side validation. Payment, advanced branching/logic, integrations/webhooks, and team collaboration remain intentionally scoped as future work or UI placeholders where applicable.
- CORS permits the local Next.js development origins (`localhost:3000` and `127.0.0.1:3000`). Update this configuration before deployment.
