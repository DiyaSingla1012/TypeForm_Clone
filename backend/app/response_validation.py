import math
import re
from typing import Any

from fastapi import HTTPException

from .models import Question, QuestionType

EMAIL_PATTERN = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


def validate_public_answers(questions: list[Question], answers: dict[str, Any]) -> dict[str, Any]:
    questions = sorted(questions, key=lambda question: question.position)
    question_map = {question.id: question for question in questions}
    unknown_ids = set(answers) - set(question_map)
    if unknown_ids:
        raise HTTPException(status_code=422, detail={"message": "Answers include unknown questions.", "question_ids": sorted(unknown_ids)})
    clean_answers: dict[str, Any] = {}
    errors: dict[str, str] = {}
    current_index = 0
    visited: set[str] = set()
    while current_index < len(questions):
        question = questions[current_index]
        if question.id in visited:
            raise HTTPException(status_code=422, detail="The form contains an invalid logic jump.")
        visited.add(question.id)
        supplied = answers.get(question.id)
        blank = supplied is None or supplied == ""
        if question.required and blank:
            errors[question.id] = "This question is required."
        elif not blank:
            try:
                clean_answers[question.id] = validate_answer(question, supplied)
            except ValueError as error:
                errors[question.id] = str(error)
        answer = clean_answers.get(question.id)
        branch_key = "Yes" if answer is True else "No" if answer is False else answer if isinstance(answer, str) else None
        target_id = (question.settings or {}).get("logic", {}).get(branch_key) if branch_key else None
        if target_id:
            target_question = question_map.get(target_id)
            if not target_question or target_question.position <= question.position:
                raise HTTPException(status_code=422, detail="The form contains an invalid logic jump.")
            current_index = questions.index(target_question)
        else:
            current_index += 1
    if errors:
        raise HTTPException(status_code=422, detail={"message": "One or more answers are invalid.", "errors": errors})
    return clean_answers


def validate_answer(question: Question, answer: Any) -> Any:
    if question.type in {QuestionType.SHORT_TEXT, QuestionType.LONG_TEXT, QuestionType.EMAIL}:
        if not isinstance(answer, str) or not answer.strip():
            raise ValueError("Enter text for this question.")
        answer = answer.strip()
        if len(answer) > 5000:
            raise ValueError("Answer is too long.")
        if question.type == QuestionType.EMAIL and not EMAIL_PATTERN.fullmatch(answer):
            raise ValueError("Enter a valid email address.")
        return answer
    if question.type == QuestionType.NUMBER:
        if isinstance(answer, bool):
            raise ValueError("Enter a valid number.")
        try:
            number = float(answer)
        except (TypeError, ValueError):
            raise ValueError("Enter a valid number.") from None
        if not math.isfinite(number):
            raise ValueError("Enter a valid number.")
        minimum, maximum = question.settings.get("min"), question.settings.get("max")
        if minimum is not None and number < minimum:
            raise ValueError(f"Enter a number of at least {minimum}.")
        if maximum is not None and number > maximum:
            raise ValueError(f"Enter a number no greater than {maximum}.")
        return int(number) if number.is_integer() else number
    if question.type == QuestionType.YES_NO:
        if not isinstance(answer, bool):
            raise ValueError("Choose Yes or No.")
        return answer
    if question.type == QuestionType.RATING:
        if isinstance(answer, bool) or not isinstance(answer, (int, float)) or int(answer) != answer:
            raise ValueError("Choose a rating.")
        steps = question.settings.get("ratingSteps", 5)
        if answer < 1 or answer > steps:
            raise ValueError(f"Choose a rating from 1 to {steps}.")
        return int(answer)
    if question.type in {QuestionType.MULTIPLE_CHOICE, QuestionType.DROPDOWN}:
        if not isinstance(answer, str):
            raise ValueError("Choose an option.")
        choices = {option.label for option in question.options}
        if answer not in choices and not (answer == "Other" and question.settings.get("allowOther")):
            raise ValueError("Choose one of the available options.")
        return answer
    if question.type == QuestionType.FILE_UPLOAD:
        if not isinstance(answer, dict) or not isinstance(answer.get("id"), str) or not isinstance(answer.get("name"), str) or not isinstance(answer.get("url"), str):
            raise ValueError("Upload a file.")
        return {"id": answer["id"], "name": answer["name"], "url": answer["url"]}
    raise ValueError("Unsupported question type.")
