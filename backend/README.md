# Typeform Builder API

FastAPI and SQLite backend for the form-builder domain.

## Run locally

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Interactive API documentation is available at `http://localhost:8000/docs`.

The SQLite database is created at `backend/data/typeform.db`. On first run it is seeded with two published forms and responses.

## Builder endpoints

- `GET /api/forms` — list forms, including question and response counts
- `POST /api/forms` — create a draft form
- `GET|PATCH|DELETE /api/forms/{form_id}` — manage a form
- `POST /api/forms/{form_id}/duplicate` — duplicate form and questions
- `PATCH /api/forms/{form_id}/publication` — publish/unpublish
- `GET|PATCH /api/forms/{form_id}/experience` — persistent theme and thank-you settings
- `GET /api/forms/{form_id}/preview` — creator preview payload, including drafts
- `GET /api/public/forms/{slug}` — unauthenticated published-form lookup for `/f/{slug}`
- `POST /api/public/forms/{slug}/responses` — server-validate and store a no-auth response
- `GET /api/forms/{form_id}/responses?limit=25&offset=0` — creator submission list
- `GET /api/forms/{form_id}/responses/{response_id}` — complete submitted answers
- `GET /api/forms/{form_id}/results/summary` — per-question response counts and aggregates
- `GET|POST /api/forms/{form_id}/questions` — list/add ordered questions
- `GET|PATCH|DELETE /api/questions/{question_id}` — manage a question
- `PUT /api/forms/{form_id}/questions/reorder` — reorder all form questions atomically

Every form response includes `share_path`, for example `/f/product-feedback-1234abcd`. Prefix it with the frontend origin for a public link.
