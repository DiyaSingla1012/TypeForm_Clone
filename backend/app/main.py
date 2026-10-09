from contextlib import asynccontextmanager

import csv
import io
import os
import uuid
from pathlib import Path

from fastapi import Depends, FastAPI, File, HTTPException, Response, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from .database import Base, engine, get_session, migrate_schema
from .models import Answer, Form, FormStatus, PartialResponse, Question, QuestionOption, Response as FormResponse, UploadedFile
from .response_validation import validate_public_answers
from .results import form_summary, response_detail, response_list
from .schemas import CompletionStats, ExperienceSettingsRead, ExperienceSettingsUpdate, FormCreate, FormDetail, FormRead, FormResultsSummary, FormUpdate, PartialResponseCreate, PartialResponseRead, PublicationUpdate, PublicResponseCreate, PublicResponseRead, QuestionCreate, QuestionRead, QuestionUpdate, ReorderQuestions, ResponseDetail, ResponseList
from .seed import seed_database
from .services import add_question, form_detail, serialize_form, serialize_question, slugify


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    migrate_schema()
    with Session(engine) as session:
        seed_database(session)
    yield


app = FastAPI(title="Typeform Builder API", version="0.1.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "https://type-form-clone-jade.vercel.app"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
UPLOAD_DIRECTORY = Path(os.getenv("TYPEFORM_UPLOAD_DIRECTORY", str(Path(__file__).resolve().parents[1] / "data" / "uploads")))
UPLOAD_DIRECTORY.mkdir(parents=True, exist_ok=True)
MAX_UPLOAD_BYTES = 10 * 1024 * 1024
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIRECTORY), name="uploads")


def get_form_or_404(session: Session, form_id: str) -> Form:
    form = form_detail(session, form_id)
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    return form


def validate_logic_rules(session: Session, form_id: str, source_id: str | None, source_position: int, question_type, options: list[str], settings: dict) -> None:
    """Allow only forward jumps within the same form, which makes cycles impossible."""
    logic = settings.get("logic")
    if not logic:
        return
    if question_type.value not in {"multiple_choice", "dropdown", "yes_no"} or not isinstance(logic, dict):
        raise HTTPException(status_code=422, detail="Logic jumps are only available for choice-based questions.")
    allowed_choices = {"Yes", "No"} if question_type.value == "yes_no" else set(options)
    if question_type.value in {"multiple_choice", "dropdown"} and settings.get("allowOther"):
        allowed_choices.add("Other")
    questions = session.scalars(select(Question).where(Question.form_id == form_id)).all()
    positions = {item.id: item.position for item in questions}
    for choice, target_id in logic.items():
        if choice not in allowed_choices or not isinstance(target_id, str):
            raise HTTPException(status_code=422, detail="Logic jumps must match a valid choice and question.")
        if target_id not in positions or target_id == source_id or positions[target_id] <= source_position:
            raise HTTPException(status_code=422, detail="Logic jumps can only target a later question in this form.")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/api/forms", response_model=list[FormRead])
def list_forms(session: Session = Depends(get_session)):
    forms = session.scalars(select(Form).order_by(Form.updated_at.desc())).all()
    return [serialize_form(session, form) for form in forms]


@app.post("/api/forms", response_model=FormDetail, status_code=status.HTTP_201_CREATED)
def create_form(payload: FormCreate, session: Session = Depends(get_session)):
    form = Form(title=payload.title.strip(), slug=slugify(payload.title))
    session.add(form)
    session.commit()
    return serialize_form(session, get_form_or_404(session, form.id), detail=True)


@app.get("/api/forms/{form_id}", response_model=FormDetail)
def get_form(form_id: str, session: Session = Depends(get_session)):
    return serialize_form(session, get_form_or_404(session, form_id), detail=True)


@app.get("/api/public/forms/{slug}", response_model=FormDetail)
def get_published_form(slug: str, session: Session = Depends(get_session)):
    """Public, unauthenticated form lookup used by the respondent experience."""
    form = session.scalar(
        select(Form)
        .options(joinedload(Form.questions).joinedload(Question.options))
        .where(Form.slug == slug, Form.status == FormStatus.PUBLISHED)
    )
    if not form:
        raise HTTPException(status_code=404, detail="Published form not found")
    return serialize_form(session, form, detail=True)


@app.post("/api/public/forms/{slug}/responses", response_model=PublicResponseRead, status_code=status.HTTP_201_CREATED)
def submit_public_response(slug: str, payload: PublicResponseCreate, session: Session = Depends(get_session)):
    """No-auth final submission endpoint for the respondent flow."""
    form = session.scalar(
        select(Form)
        .options(joinedload(Form.questions).joinedload(Question.options))
        .where(Form.slug == slug, Form.status == FormStatus.PUBLISHED)
    )
    if not form:
        raise HTTPException(status_code=404, detail="Published form not found")
    clean_answers = validate_public_answers(form.questions, payload.answers)
    for question in form.questions:
        if question.type.value != "file_upload" or question.id not in clean_answers:
            continue
        answer = clean_answers[question.id]
        uploaded = session.get(UploadedFile, answer["id"])
        if not uploaded or uploaded.form_id != form.id or answer["url"] != f"/uploads/{uploaded.stored_name}":
            raise HTTPException(status_code=422, detail="The uploaded file is not valid for this form.")
    submission = FormResponse(form=form)
    submission.answers = [Answer(question_id=question_id, value=value) for question_id, value in clean_answers.items()]
    session.add(submission)
    if payload.partial_id:
        partial = session.get(PartialResponse, payload.partial_id)
        if partial and partial.form_id == form.id:
            session.delete(partial)
    session.commit()
    return PublicResponseRead(response_id=submission.id, submitted_at=submission.submitted_at, thank_you_title=form.thank_you_title, thank_you_message=form.thank_you_message)


@app.post("/api/public/forms/{slug}/partials", response_model=PartialResponseRead)
def save_partial_response(slug: str, payload: PartialResponseCreate, session: Session = Depends(get_session)):
    form = session.scalar(select(Form).where(Form.slug == slug, Form.status == FormStatus.PUBLISHED))
    if not form:
        raise HTTPException(status_code=404, detail="Published form not found")
    partial = session.get(PartialResponse, payload.partial_id) if payload.partial_id else None
    if not partial or partial.form_id != form.id:
        partial = PartialResponse(form_id=form.id)
        session.add(partial)
    partial.answers = payload.answers
    session.commit()
    return PartialResponseRead(partial_id=partial.id)


@app.post("/api/public/forms/{slug}/uploads")
def upload_public_file(slug: str, file: UploadFile = File(...), session: Session = Depends(get_session)):
    form = session.scalar(select(Form).where(Form.slug == slug, Form.status == FormStatus.PUBLISHED))
    if not form:
        raise HTTPException(status_code=404, detail="Published form not found")
    if not file.filename:
        raise HTTPException(status_code=422, detail="Choose a file to upload")
    original_name = Path(file.filename).name
    suffix = Path(original_name).suffix[:12]
    saved_name = f"{uuid.uuid4().hex}{suffix}"
    destination_path = UPLOAD_DIRECTORY / saved_name
    size_bytes = 0
    try:
        with destination_path.open("wb") as destination:
            while chunk := file.file.read(64 * 1024):
                size_bytes += len(chunk)
                if size_bytes > MAX_UPLOAD_BYTES:
                    raise HTTPException(status_code=413, detail="Files must be 10 MB or smaller.")
                destination.write(chunk)
    except Exception:
        destination_path.unlink(missing_ok=True)
        raise
    uploaded = UploadedFile(form_id=form.id, original_name=original_name, stored_name=saved_name, content_type=file.content_type or "application/octet-stream", size_bytes=size_bytes)
    session.add(uploaded)
    session.commit()
    return {"id": uploaded.id, "name": uploaded.original_name, "url": f"/uploads/{saved_name}"}


@app.get("/api/forms/{form_id}/responses", response_model=ResponseList)
def list_form_responses(form_id: str, limit: int = 25, offset: int = 0, session: Session = Depends(get_session)):
    get_form_or_404(session, form_id)
    if not 1 <= limit <= 100:
        raise HTTPException(status_code=422, detail="limit must be between 1 and 100")
    if offset < 0:
        raise HTTPException(status_code=422, detail="offset must be at least 0")
    return response_list(session, form_id, limit, offset)


@app.get("/api/forms/{form_id}/responses/{response_id}", response_model=ResponseDetail)
def get_form_response(form_id: str, response_id: str, session: Session = Depends(get_session)):
    get_form_or_404(session, form_id)
    result = response_detail(session, form_id, response_id)
    if not result:
        raise HTTPException(status_code=404, detail="Response not found")
    return result


@app.get("/api/forms/{form_id}/results/summary", response_model=FormResultsSummary)
def get_results_summary(form_id: str, session: Session = Depends(get_session)):
    return form_summary(session, get_form_or_404(session, form_id))


@app.get("/api/forms/{form_id}/completion", response_model=CompletionStats)
def get_completion_stats(form_id: str, session: Session = Depends(get_session)):
    get_form_or_404(session, form_id)
    completed = session.scalar(select(func.count()).select_from(FormResponse).where(FormResponse.form_id == form_id)) or 0
    partial = session.scalar(select(func.count()).select_from(PartialResponse).where(PartialResponse.form_id == form_id)) or 0
    started = completed + partial
    return CompletionStats(started=started, completed=completed, partial=partial, completion_rate=round((completed / started) * 100, 1) if started else 0)


@app.get("/api/forms/{form_id}/export/responses.csv")
def export_responses_csv(form_id: str, session: Session = Depends(get_session)):
    form = get_form_or_404(session, form_id)
    submissions = session.scalars(select(FormResponse).options(joinedload(FormResponse.answers)).where(FormResponse.form_id == form_id).order_by(FormResponse.submitted_at.desc())).unique().all()
    stream = io.StringIO()
    writer = csv.writer(stream)
    writer.writerow(["response_id", "submitted_at", *[question.title or f"Question {index + 1}" for index, question in enumerate(form.questions)]])
    for submission in submissions:
        answers = {answer.question_id: answer.value for answer in submission.answers}
        writer.writerow([submission.id, submission.submitted_at.isoformat(), *[answers.get(question.id, "") for question in form.questions]])
    return StreamingResponse(iter([stream.getvalue()]), media_type="text/csv", headers={"Content-Disposition": f'attachment; filename="{form.slug}-responses.csv"'})


@app.patch("/api/forms/{form_id}", response_model=FormDetail)
def update_form(form_id: str, payload: FormUpdate, session: Session = Depends(get_session)):
    form = get_form_or_404(session, form_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(form, field, value)
    session.commit()
    return serialize_form(session, get_form_or_404(session, form_id), detail=True)


@app.get("/api/forms/{form_id}/experience", response_model=ExperienceSettingsRead)
def get_experience_settings(form_id: str, session: Session = Depends(get_session)):
    form = get_form_or_404(session, form_id)
    return ExperienceSettingsRead(theme=form.theme, appearance=form.appearance or {}, thank_you_title=form.thank_you_title, thank_you_message=form.thank_you_message)


@app.patch("/api/forms/{form_id}/experience", response_model=ExperienceSettingsRead)
def update_experience_settings(form_id: str, payload: ExperienceSettingsUpdate, session: Session = Depends(get_session)):
    form = get_form_or_404(session, form_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(form, field, value)
    session.commit()
    return ExperienceSettingsRead(theme=form.theme, appearance=form.appearance or {}, thank_you_title=form.thank_you_title, thank_you_message=form.thank_you_message)


@app.get("/api/forms/{form_id}/preview", response_model=FormDetail)
def get_builder_preview(form_id: str, session: Session = Depends(get_session)):
    """Creator preview data; unlike the public route, drafts are intentionally allowed."""
    return serialize_form(session, get_form_or_404(session, form_id), detail=True)


@app.delete("/api/forms/{form_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_form(form_id: str, session: Session = Depends(get_session)):
    form = get_form_or_404(session, form_id)
    for uploaded in session.scalars(select(UploadedFile).where(UploadedFile.form_id == form_id)).all():
        (UPLOAD_DIRECTORY / uploaded.stored_name).unlink(missing_ok=True)
        session.delete(uploaded)
    session.delete(form)
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.post("/api/forms/{form_id}/duplicate", response_model=FormDetail, status_code=status.HTTP_201_CREATED)
def duplicate_form(form_id: str, session: Session = Depends(get_session)):
    source = get_form_or_404(session, form_id)
    copy = Form(title=f"{source.title} (copy)", slug=slugify(source.title), theme=source.theme, thank_you_title=source.thank_you_title, thank_you_message=source.thank_you_message)
    session.add(copy)
    session.flush()
    for source_question in source.questions:
        copy_question = Question(form=copy, position=source_question.position)
        add_question(copy_question, serialize_question(source_question))
        session.add(copy_question)
    session.commit()
    return serialize_form(session, get_form_or_404(session, copy.id), detail=True)


@app.patch("/api/forms/{form_id}/publication", response_model=FormDetail)
def set_publication(form_id: str, payload: PublicationUpdate, session: Session = Depends(get_session)):
    form = get_form_or_404(session, form_id)
    form.status = payload.status
    session.commit()
    return serialize_form(session, get_form_or_404(session, form_id), detail=True)


@app.get("/api/forms/{form_id}/questions", response_model=list[QuestionRead])
def list_questions(form_id: str, session: Session = Depends(get_session)):
    form = get_form_or_404(session, form_id)
    return [serialize_question(question) for question in form.questions]


@app.post("/api/forms/{form_id}/questions", response_model=QuestionRead, status_code=status.HTTP_201_CREATED)
def create_question(form_id: str, payload: QuestionCreate, session: Session = Depends(get_session)):
    form = get_form_or_404(session, form_id)
    position = payload.position if payload.position is not None else len(form.questions)
    if position > len(form.questions):
        raise HTTPException(status_code=422, detail="Position cannot exceed question count")
    validate_logic_rules(session, form_id, None, position, payload.type, payload.options, payload.settings)
    for item in form.questions:
        if item.position >= position:
            item.position += 1000
    session.flush()
    for item in form.questions:
        if item.position >= position + 1000:
            item.position -= 999
    question = Question(form=form, position=position)
    add_question(question, payload)
    session.add(question)
    session.commit()
    return serialize_question(question)


@app.get("/api/questions/{question_id}", response_model=QuestionRead)
def get_question(question_id: str, session: Session = Depends(get_session)):
    question = session.scalar(select(Question).options(joinedload(Question.options)).where(Question.id == question_id))
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    return serialize_question(question)


@app.patch("/api/questions/{question_id}", response_model=QuestionRead)
def update_question(question_id: str, payload: QuestionUpdate, session: Session = Depends(get_session)):
    question = session.scalar(select(Question).options(joinedload(Question.options)).where(Question.id == question_id))
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    values = payload.model_dump(exclude_unset=True)
    prospective_type = values.get("type", question.type)
    prospective_options = values.get("options", [option.label for option in question.options])
    if prospective_type.value in {"multiple_choice", "dropdown"} and len(prospective_options) < 2:
        raise HTTPException(status_code=422, detail="Multiple choice and dropdown questions require at least two options")
    prospective_settings = values.get("settings", question.settings or {})
    validate_logic_rules(session, question.form_id, question.id, question.position, prospective_type, prospective_options, prospective_settings)
    if "options" in values:
        question.options.clear()
        # Flush removals before inserting positions 0..n again; SQLite enforces
        # the (question_id, position) uniqueness constraint immediately.
        session.flush()
        question.options.extend(QuestionOption(position=index, label=label) for index, label in enumerate(values.pop("options")))
    for field, value in values.items():
        setattr(question, field, value)
    session.commit()
    return serialize_question(question)


@app.delete("/api/questions/{question_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_question(question_id: str, session: Session = Depends(get_session)):
    question = session.get(Question, question_id)
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    form_id, position = question.form_id, question.position
    # Remove rules that targeted the deleted question so remaining logic stays valid.
    for source in session.scalars(select(Question).where(Question.form_id == form_id, Question.id != question_id)).all():
        logic = (source.settings or {}).get("logic", {})
        if isinstance(logic, dict) and question_id in logic.values():
            source.settings = {**source.settings, "logic": {key: value for key, value in logic.items() if value != question_id}}
    # Existing submissions can reference a question. Remove only those answer
    # values so a creator can still edit their form at any time.
    for answer in session.scalars(select(Answer).where(Answer.question_id == question_id)).all():
        session.delete(answer)
    session.delete(question)
    session.flush()
    remaining = session.scalars(
        select(Question).where(Question.form_id == form_id, Question.position > position).order_by(Question.position)
    ).all()
    # SQLite checks uq_question_form_position for each update. Move rows to a
    # temporary negative range first so deleting position 0 cannot collide with
    # the existing row at position 0 while positions are compacted.
    for index, item in enumerate(remaining):
        item.position = -(index + 1)
    session.flush()
    for index, item in enumerate(remaining, start=position):
        item.position = index
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.put("/api/forms/{form_id}/questions/reorder", response_model=list[QuestionRead])
def reorder_questions(form_id: str, payload: ReorderQuestions, session: Session = Depends(get_session)):
    form = get_form_or_404(session, form_id)
    actual_ids = [question.id for question in form.questions]
    if len(payload.question_ids) != len(actual_ids) or set(payload.question_ids) != set(actual_ids):
        raise HTTPException(status_code=422, detail="question_ids must contain every form question exactly once")
    questions = {question.id: question for question in form.questions}
    new_positions = {question_id: index for index, question_id in enumerate(payload.question_ids)}
    for question in form.questions:
        logic = (question.settings or {}).get("logic", {})
        if isinstance(logic, dict) and any(target_id not in new_positions or new_positions[target_id] <= new_positions[question.id] for target_id in logic.values()):
            raise HTTPException(status_code=422, detail="Reordering would create an invalid logic jump.")
    for index, question_id in enumerate(payload.question_ids):
        questions[question_id].position = -(index + 1)
    session.flush()
    for index, question_id in enumerate(payload.question_ids):
        questions[question_id].position = index
    session.commit()
    return [serialize_question(questions[question_id]) for question_id in payload.question_ids]
