"use client";

import { useCallback, useEffect, useState } from "react";
import { formThemes, type Answer, type Form } from "@/types/form";
import { validateAnswer } from "@/lib/validation";
import { api } from "@/lib/api";
import { AnswerField } from "./AnswerField";

export function RespondentFlow({ form }: { form: Form }) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [error, setError] = useState<string | null>(null);
  const [complete, setComplete] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [partialId, setPartialId] = useState<string>();
  const question = form.questions[index];
  const last = index === form.questions.length - 1;

  const advance = useCallback(async () => {
    if (!question) return;
    const message = validateAnswer(question, answers[question.id]);
    if (message) {
      setError(message);
      return;
    }
    setError(null);
    if (last) {
      setSubmitting(true);
      try {
        await api.submitResponse(form.slug, answers, partialId);
        setComplete(true);
      } catch (error) {
        setError(
          error instanceof Error
            ? error.message
            : "We could not submit your response.",
        );
      } finally {
        setSubmitting(false);
      }
      return;
    }
    try {
      const saved = await api.savePartial(form.slug, answers, partialId);
      setPartialId(saved.partial_id);
      const answer = answers[question.id];
      const branchKey =
        answer === true
          ? "Yes"
          : answer === false
            ? "No"
            : typeof answer === "string"
              ? answer
              : undefined;
      const targetId = branchKey
        ? question.settings.logic?.[branchKey]
        : undefined;
      const targetIndex = targetId
        ? form.questions.findIndex((item) => item.id === targetId)
        : -1;
      setIndex(targetIndex >= 0 ? targetIndex : (current) => current + 1);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "We could not save your progress.",
      );
    }
  }, [answers, form.slug, last, partialId, question]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight" || event.key === "Enter") {
        const target = event.target as HTMLElement;
        if (
          target.tagName === "TEXTAREA" &&
          event.key === "Enter" &&
          !event.metaKey &&
          !event.ctrlKey
        )
          return;
        event.preventDefault();
        void advance();
      }
      if (event.key === "ArrowLeft" && index > 0) {
        event.preventDefault();
        setError(null);
        setIndex((current) => current - 1);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [advance, index]);

  if (complete) return <ThankYou form={form} />;
  if (!question) return <EmptyPublishedForm form={form} />;
  const percentage = ((index + 1) / form.questions.length) * 100;
  const theme = formThemes[form.theme];
  const lightTheme = form.theme !== "ink";
  const style = {
    ["--flow-background" as string]:
      form.appearance.background || theme.background,
    ["--flow-accent" as string]: form.appearance.accent || theme.accent,
    ["--flow-text" as string]: lightTheme ? "#1f2530" : "#f7f7f2",
    ["--flow-muted" as string]: lightTheme ? "#43516a" : "#d0d0d1",
    ["--flow-border" as string]: lightTheme ? "#73809a" : "#9b9b9f",
    ["--flow-placeholder" as string]: lightTheme ? "#5d6a83" : "#c4c4c7",
    ["--flow-control-background" as string]: lightTheme
      ? "#fffffff0"
      : "#303035",
    ["--flow-progress-track" as string]: lightTheme ? "#c5cee3" : "#4a4a4e",
    fontFamily:
      form.appearance.font === "serif"
        ? "Georgia, serif"
        : form.appearance.font === "mono"
          ? "ui-monospace, monospace"
          : undefined,
  };
  return (
    <main className={`respondent-flow theme-${form.theme}`} style={style}>
      <header className="flow-header">
        <span className="flow-logo">t</span>
        <span className="flow-progress-text">
          {index + 1} of {form.questions.length}
        </span>
      </header>
      <div className="flow-progress">
        <i style={{ width: `${percentage}%` }} />
      </div>
      <section className="question-screen" key={question.id}>
        <div className="question-prompt">
          <span>
            {index + 1} <i>→</i>
          </span>
          <h1 className="flow-question-title">
            {question.title || "Untitled question"}
            {question.required && <em>*</em>}
          </h1>
          {question.description && (
            <p className="flow-description">{question.description}</p>
          )}
        </div>
        <div className="question-answer">
          <AnswerField
            question={question}
            value={answers[question.id]}
            onChange={(answer) => {
              setAnswers((current) => ({ ...current, [question.id]: answer }));
              setError(null);
            }}
            onUpload={async (file) => {
              try {
                const uploaded = await api.uploadFile(form.slug, file);
                setAnswers((current) => ({
                  ...current,
                  [question.id]: uploaded,
                }));
                setError(null);
              } catch (uploadError) {
                setError(
                  uploadError instanceof Error
                    ? uploadError.message
                    : "Upload failed.",
                );
              }
            }}
            onAdvance={() => void advance()}
          />
          {error && (
            <p className="flow-error" role="alert">
              {error}
            </p>
          )}
          <button
            className="flow-continue"
            disabled={submitting}
            onClick={() => void advance()}
          >
            {submitting ? "Submitting…" : last ? "Submit" : "OK"} <span>↵</span>
          </button>
          {index > 0 && (
            <button
              className="flow-back"
              onClick={() => {
                setError(null);
                setIndex((current) => current - 1);
              }}
            >
              ← Back
            </button>
          )}
        </div>
      </section>
      <footer className="flow-footer">
        <span>
          Press <kbd>Enter</kbd> to continue
        </span>
        <span>
          <kbd>←</kbd> <kbd>→</kbd> Navigate
        </span>
      </footer>
    </main>
  );
}

function ThankYou({ form }: { form: Form }) {
  const theme = formThemes[form.theme];
  return (
    <main
      className={`respondent-flow thank-you theme-${form.theme}`}
      style={{
        ["--flow-background" as string]:
          form.appearance.background || theme.background,
        ["--flow-accent" as string]: form.appearance.accent || theme.accent,
        fontFamily:
          form.appearance.font === "serif"
            ? "Georgia, serif"
            : form.appearance.font === "mono"
              ? "ui-monospace, monospace"
              : undefined,
      }}
    >
      <div className="thanks-card">
        <span className="flow-logo">t</span>
        <h1>{form.thankYou.title}</h1>
        <p>{form.thankYou.message}</p>
        <span>You can safely close this page.</span>
      </div>
    </main>
  );
}

function EmptyPublishedForm({ form }: { form: Form }) {
  const theme = formThemes[form.theme];
  return (
    <main
      className={`respondent-flow thank-you theme-${form.theme}`}
      style={{
        ["--flow-background" as string]:
          form.appearance.background || theme.background,
        ["--flow-accent" as string]: form.appearance.accent || theme.accent,
      }}
    >
      <div className="thanks-card">
        <span className="flow-logo">t</span>
        <h1>This form is not ready yet</h1>
        <p>
          The creator has not added any questions to{" "}
          <strong>{form.title}</strong>.
        </p>
      </div>
    </main>
  );
}
