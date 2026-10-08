"use client";

import { useState } from "react";
import { formThemes, type Form, type Question } from "@/types/form";

/** A creator-only walkthrough: it previews questions but never submits a response. */
export function FormPreview({
  form,
  initialIndex,
}: {
  form: Form;
  initialIndex: number;
}) {
  const [index, setIndex] = useState(
    Math.min(Math.max(initialIndex, 0), Math.max(form.questions.length - 1, 0)),
  );
  const question = form.questions[index];
  const colors = formThemes[form.theme];
  const lightTheme = form.theme !== "ink";
  const previewStyle = {
    background: colors.background,
    ["--preview-accent" as string]: colors.accent,
    ["--preview-text" as string]: lightTheme ? "#1f2530" : "#f7f7f2",
    ["--preview-muted" as string]: lightTheme ? "#43516a" : "#d0d0d1",
    ["--preview-border" as string]: lightTheme ? "#73809a" : "#9b9b9f",
    ["--preview-control-background" as string]: lightTheme
      ? "#fffffff0"
      : "#303035",
  };

  if (!question)
    return (
      <div
        className={`preview-shell preview-theme-${form.theme}`}
        style={previewStyle}
      >
        <div className="preview-empty">
          Add a question to preview this form.
        </div>
      </div>
    );

  const last = index === form.questions.length - 1;
  return (
    <div
      className={`preview-shell preview-theme-${form.theme}`}
      style={previewStyle}
    >
      <div className="preview-top">
        <strong>{form.title || "Untitled form"}</strong>
        <span>
          {index + 1} of {form.questions.length}
        </span>
      </div>
      <div className="preview-content" key={question.id}>
        <span className="preview-number">
          {index + 1} <i>→</i>
        </span>
        <h1>
          {question.title || "Untitled question"}
          {question.required && <em>*</em>}
        </h1>
        {question.description && <p>{question.description}</p>}
        <PreviewInput question={question} />
        <div className="preview-actions">
          {index > 0 && (
            <button
              type="button"
              className="preview-back"
              onClick={() => setIndex((current) => current - 1)}
            >
              ← Back
            </button>
          )}
          <button
            type="button"
            className="continue-button"
            onClick={() => !last && setIndex((current) => current + 1)}
            disabled={last}
          >
            {last ? (
              "End of preview"
            ) : (
              <>
                OK <span>↵</span>
              </>
            )}
          </button>
        </div>
      </div>
      <div className="preview-progress">
        <i
          style={{ width: `${((index + 1) / form.questions.length) * 100}%` }}
        />
      </div>
    </div>
  );
}

function PreviewInput({ question }: { question: Question }) {
  if (question.type === "long_text")
    return (
      <div className="preview-input large">
        {question.settings.placeholder || "Type your answer here..."}
      </div>
    );
  if (question.type === "multiple_choice" || question.type === "dropdown")
    return (
      <div className="preview-options">
        {(question.options ?? []).map((option, optionIndex) => (
          <div key={option || optionIndex}>
            <b>{String.fromCharCode(65 + optionIndex)}</b>
            {option || "Option"}
          </div>
        ))}
        {question.settings.allowOther && (
          <div>
            <b>O</b>Other
          </div>
        )}
      </div>
    );
  if (question.type === "yes_no")
    return (
      <div className="preview-options">
        <div>
          <b>Y</b>Yes
        </div>
        <div>
          <b>N</b>No
        </div>
      </div>
    );
  if (question.type === "rating")
    return (
      <>
        <div className="rating-row">
          {Array.from(
            { length: question.settings.ratingSteps ?? 5 },
            (_, ratingIndex) => (
              <b key={ratingIndex}>{ratingIndex + 1}</b>
            ),
          )}
        </div>
        <div className="rating-labels">
          <span>{question.settings.ratingLowLabel}</span>
          <span>{question.settings.ratingHighLabel}</span>
        </div>
      </>
    );
  if (question.type === "file_upload")
    return (
      <div className="preview-upload">
        <strong>Choose a file</strong>
        <span>File picker available in the live form</span>
      </div>
    );
  return (
    <div className="preview-input">
      {question.settings.placeholder || "Type your answer here..."}
    </div>
  );
}
