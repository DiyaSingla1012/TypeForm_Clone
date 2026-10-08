from collections import Counter
from numbers import Real

from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from .models import Answer, Form, Question, QuestionType, Response
from .schemas import AnswerRead, ChoiceCount, FormResultsSummary, QuestionSummary, ResponseDetail, ResponseList, ResponseListItem


def response_list(session: Session, form_id: str, limit: int, offset: int) -> ResponseList:
    total = session.scalar(select(func.count()).select_from(Response).where(Response.form_id == form_id)) or 0
    submissions = session.scalars(
        select(Response)
        .options(joinedload(Response.answers))
        .where(Response.form_id == form_id)
        .order_by(Response.submitted_at.desc())
        .offset(offset)
        .limit(limit)
    ).unique().all()
    return ResponseList(items=[ResponseListItem(id=item.id, submitted_at=item.submitted_at, answer_count=len(item.answers)) for item in submissions], total=total, limit=limit, offset=offset)


def response_detail(session: Session, form_id: str, response_id: str) -> ResponseDetail | None:
    submission = session.scalar(select(Response).options(joinedload(Response.answers)).where(Response.id == response_id, Response.form_id == form_id))
    if not submission:
        return None
    return ResponseDetail(id=submission.id, form_id=submission.form_id, submitted_at=submission.submitted_at, answers=[AnswerRead(question_id=answer.question_id, value=answer.value) for answer in submission.answers])


def form_summary(session: Session, form: Form) -> FormResultsSummary:
    total_responses = session.scalar(select(func.count()).select_from(Response).where(Response.form_id == form.id)) or 0
    answer_rows = session.execute(
        select(Answer.question_id, Answer.value, Response.submitted_at)
        .join(Response, Answer.response_id == Response.id)
        .where(Response.form_id == form.id)
        .order_by(Response.submitted_at.desc())
    ).all()
    by_question: dict[str, list[tuple[object, object]]] = {question.id: [] for question in form.questions}
    for question_id, value, submitted_at in answer_rows:
        by_question.setdefault(question_id, []).append((value, submitted_at))

    summaries: list[QuestionSummary] = []
    choice_types = {QuestionType.MULTIPLE_CHOICE, QuestionType.DROPDOWN, QuestionType.YES_NO, QuestionType.RATING}
    for question in form.questions:
        values = [value for value, _ in by_question.get(question.id, [])]
        summary = QuestionSummary(question_id=question.id, question_type=question.type, title=question.title, response_count=total_responses, answered_count=len(values))
        if question.type in choice_types:
            if question.type == QuestionType.YES_NO:
                candidates = ["Yes", "No"]
                normalized = ["Yes" if value is True else "No" if value is False else str(value) for value in values]
            elif question.type == QuestionType.RATING:
                candidates = [str(value) for value in range(1, int(question.settings.get("ratingSteps", 5)) + 1)]
                normalized = [str(value) for value in values]
            else:
                candidates = [option.label for option in question.options]
                if question.settings.get("allowOther"):
                    candidates.append("Other")
                normalized = [str(value) for value in values]
            counter = Counter(normalized)
            summary.choice_counts = [ChoiceCount(value=value, count=counter[value], percentage=round((counter[value] / total_responses) * 100, 2) if total_responses else 0) for value in candidates]
        numeric = [float(value) for value in values if isinstance(value, Real) and not isinstance(value, bool)]
        if numeric:
            summary.average = round(sum(numeric) / len(numeric), 2)
            summary.minimum = min(numeric)
            summary.maximum = max(numeric)
        if question.type in {QuestionType.SHORT_TEXT, QuestionType.LONG_TEXT, QuestionType.EMAIL} and values:
            summary.latest_text_answer = str(values[0])
        summaries.append(summary)
    return FormResultsSummary(form_id=form.id, total_responses=total_responses, questions=summaries)
