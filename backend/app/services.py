import re
import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from .models import Form, FormStatus, Question, QuestionOption
from .schemas import FormDetail, FormRead, QuestionInput, QuestionRead


def slugify(title: str) -> str:
    stem = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-") or "form"
    return f"{stem[:90]}-{uuid.uuid4().hex[:8]}"


def serialize_question(question: Question) -> QuestionRead:
    return QuestionRead(id=question.id, position=question.position, type=question.type, title=question.title, description=question.description, required=question.required, settings=question.settings or {}, options=[option.label for option in question.options])


def counts(session: Session, form_id: str) -> tuple[int, int]:
    question_count = session.scalar(select(func.count()).select_from(Question).where(Question.form_id == form_id)) or 0
    from .models import Response
    response_count = session.scalar(select(func.count()).select_from(Response).where(Response.form_id == form_id)) or 0
    return question_count, response_count


def serialize_form(session: Session, form: Form, detail: bool = False) -> FormRead | FormDetail:
    question_count, response_count = counts(session, form.id)
    base = dict(id=form.id, title=form.title, slug=form.slug, status=form.status, theme=form.theme, appearance=form.appearance or {}, thank_you_title=form.thank_you_title, thank_you_message=form.thank_you_message, created_at=form.created_at, updated_at=form.updated_at, question_count=question_count, response_count=response_count, share_path=f"/f/{form.slug}")
    if detail:
        return FormDetail(**base, questions=[serialize_question(question) for question in sorted(form.questions, key=lambda item: item.position)])
    return FormRead(**base)


def form_detail(session: Session, form_id: str) -> Form | None:
    return session.scalar(select(Form).options(joinedload(Form.questions).joinedload(Question.options)).where(Form.id == form_id))


def add_question(question: Question, data: QuestionInput) -> None:
    question.type = data.type
    question.title = data.title
    question.description = data.description
    question.required = data.required
    question.settings = data.settings
    question.options.clear()
    question.options.extend(QuestionOption(position=index, label=label) for index, label in enumerate(data.options))
