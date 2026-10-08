from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import Answer, Form, FormStatus, Question, QuestionOption, QuestionType, Response
from .services import slugify


def question(form: Form, position: int, kind: QuestionType, title: str, *, required: bool = False, description: str = "", options: list[str] | None = None, settings: dict | None = None) -> Question:
    item = Question(form=form, position=position, type=kind, title=title, description=description, required=required, settings=settings or {})
    item.options = [QuestionOption(position=index, label=label) for index, label in enumerate(options or [])]
    return item


def seed_database(session: Session) -> None:
    """Add the bundled examples without touching a creator's existing forms.

    Checking for any form made the examples disappear permanently when a creator
    created a form before the initial seed completed.  Match the two sample
    titles instead, so each sample is independently restored when absent.
    """
    existing_titles = set(session.scalars(select(Form.title)).all())
    added = False

    if "Product feedback" not in existing_titles:
        feedback = Form(title="Product feedback", slug=slugify("product-feedback"), status=FormStatus.PUBLISHED, theme="blue", thank_you_title="Thanks for your feedback!", thank_you_message="Your thoughts help us improve.")
        feedback.questions = [
            question(feedback, 0, QuestionType.SHORT_TEXT, "What should we call you?", required=True),
            question(feedback, 1, QuestionType.EMAIL, "What is your email address?", required=True),
            question(feedback, 2, QuestionType.RATING, "How likely are you to recommend us?", required=True, settings={"ratingSteps": 5, "ratingLowLabel": "Not likely", "ratingHighLabel": "Very likely"}),
            question(feedback, 3, QuestionType.MULTIPLE_CHOICE, "Which feature do you use most?", options=["Forms", "Analytics", "Automations"], settings={"allowOther": True}),
            question(feedback, 4, QuestionType.LONG_TEXT, "What is one thing we could improve?", description="A sentence or two is perfect.")
        ]
        session.add(feedback)
        session.flush()
        first = Response(form=feedback)
        first.answers = [Answer(question_id=feedback.questions[0].id, value="Maya"), Answer(question_id=feedback.questions[1].id, value="maya@example.com"), Answer(question_id=feedback.questions[2].id, value=5), Answer(question_id=feedback.questions[3].id, value="Analytics"), Answer(question_id=feedback.questions[4].id, value="I would love more chart customization.")]
        second = Response(form=feedback)
        second.answers = [Answer(question_id=feedback.questions[0].id, value="Sam"), Answer(question_id=feedback.questions[1].id, value="sam@example.com"), Answer(question_id=feedback.questions[2].id, value=4), Answer(question_id=feedback.questions[3].id, value="Forms")]
        session.add_all([first, second])
        added = True

    if "Community meetup RSVP" not in existing_titles:
        event = Form(title="Community meetup RSVP", slug=slugify("community-meetup"), status=FormStatus.PUBLISHED, theme="sage", thank_you_title="You’re on the list!", thank_you_message="We’ll see you at the meetup.")
        event.questions = [
            question(event, 0, QuestionType.SHORT_TEXT, "What is your name?", required=True),
            question(event, 1, QuestionType.DROPDOWN, "Which session interests you?", required=True, options=["Design systems", "AI prototyping", "Founder stories"]),
            question(event, 2, QuestionType.YES_NO, "Would you like event updates?", required=True),
            question(event, 3, QuestionType.NUMBER, "How many guests are you bringing?", settings={"min": 0, "max": 4})
        ]
        session.add(event)
        added = True

    if added:
        session.commit()
