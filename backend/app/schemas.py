from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from .models import FormStatus, QuestionType


class QuestionInput(BaseModel):
    type: QuestionType
    title: str = Field(default="", max_length=5000)
    description: str = Field(default="", max_length=5000)
    required: bool = False
    settings: dict[str, Any] = Field(default_factory=dict)
    options: list[str] = Field(default_factory=list, max_length=100)

    @field_validator("options")
    @classmethod
    def clean_options(cls, value: list[str]) -> list[str]:
        return [option.strip() for option in value if option.strip()]

    @model_validator(mode="after")
    def require_choice_options(self):
        if self.type in {QuestionType.MULTIPLE_CHOICE, QuestionType.DROPDOWN} and len(self.options) < 2:
            raise ValueError("Multiple choice and dropdown questions require at least two options.")
        return self


class QuestionCreate(QuestionInput):
    position: int | None = Field(default=None, ge=0)


class QuestionUpdate(BaseModel):
    type: QuestionType | None = None
    title: str | None = Field(default=None, max_length=5000)
    description: str | None = Field(default=None, max_length=5000)
    required: bool | None = None
    settings: dict[str, Any] | None = None
    options: list[str] | None = Field(default=None, max_length=100)

    @field_validator("options")
    @classmethod
    def clean_options(cls, value: list[str] | None) -> list[str] | None:
        return [option.strip() for option in value if option.strip()] if value is not None else value


class QuestionRead(QuestionInput):
    model_config = ConfigDict(from_attributes=True)
    id: str
    position: int


class FormCreate(BaseModel):
    title: str = Field(default="Untitled form", min_length=1, max_length=255)


class FormUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    theme: str | None = Field(default=None, pattern="^(blue|peach|sage|ink)$")
    thank_you_title: str | None = Field(default=None, max_length=255)
    thank_you_message: str | None = Field(default=None, max_length=5000)
    appearance: dict[str, Any] | None = None


class ExperienceSettingsUpdate(BaseModel):
    """Persisted configuration consumed by builder preview and public flow."""
    theme: str | None = Field(default=None, pattern="^(blue|peach|sage|ink)$")
    thank_you_title: str | None = Field(default=None, min_length=1, max_length=255)
    thank_you_message: str | None = Field(default=None, min_length=1, max_length=5000)
    appearance: dict[str, Any] | None = None


class ExperienceSettingsRead(BaseModel):
    theme: str
    thank_you_title: str
    thank_you_message: str
    appearance: dict[str, Any] = Field(default_factory=dict)


class PublicationUpdate(BaseModel):
    status: FormStatus


class FormRead(BaseModel):
    id: str
    title: str
    slug: str
    status: FormStatus
    theme: str
    appearance: dict[str, Any] = Field(default_factory=dict)
    thank_you_title: str
    thank_you_message: str
    created_at: datetime
    updated_at: datetime
    question_count: int
    response_count: int
    share_path: str


class FormDetail(FormRead):
    questions: list[QuestionRead]


class ReorderQuestions(BaseModel):
    question_ids: list[str] = Field(min_length=0)


class PublicResponseCreate(BaseModel):
    """Answers keyed by question ID; values are validated before persistence."""
    answers: dict[str, Any] = Field(default_factory=dict)
    partial_id: str | None = None


class PartialResponseCreate(BaseModel):
    partial_id: str | None = None
    answers: dict[str, Any] = Field(default_factory=dict)


class PartialResponseRead(BaseModel):
    partial_id: str


class CompletionStats(BaseModel):
    started: int
    completed: int
    partial: int
    completion_rate: float


class PublicResponseRead(BaseModel):
    response_id: str
    submitted_at: datetime
    thank_you_title: str
    thank_you_message: str


class ResponseListItem(BaseModel):
    id: str
    submitted_at: datetime
    answer_count: int


class ResponseList(BaseModel):
    items: list[ResponseListItem]
    total: int
    limit: int
    offset: int


class AnswerRead(BaseModel):
    question_id: str
    value: Any


class ResponseDetail(BaseModel):
    id: str
    form_id: str
    submitted_at: datetime
    answers: list[AnswerRead]


class ChoiceCount(BaseModel):
    value: str
    count: int
    percentage: float


class QuestionSummary(BaseModel):
    question_id: str
    question_type: QuestionType
    title: str
    response_count: int
    answered_count: int
    choice_counts: list[ChoiceCount] = Field(default_factory=list)
    average: float | None = None
    minimum: float | None = None
    maximum: float | None = None
    latest_text_answer: str | None = None


class FormResultsSummary(BaseModel):
    form_id: str
    total_responses: int
    questions: list[QuestionSummary]
