"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, apiResponseToResponse } from "@/lib/api";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import type { Answer, Form, Question, Response } from "@/types/form";

type Summary = {
  question: Question;
  answeredCount: number;
  counts: Map<string, number>;
  average?: number;
  latestText?: string | null;
};

export function ResultsView({ formId }: { formId: string }) {
  const [form, setForm] = useState<Form | null | undefined>(undefined);
  const [responses, setResponses] = useState<Response[]>([]);
  const [summary, setSummary] = useState<Summary[]>([]);
  const [selected, setSelected] = useState<Response | null>(null);
  const [completion, setCompletion] = useState<{
    started: number;
    completed: number;
    partial: number;
    completion_rate: number;
  } | null>(null);
  useEffect(() => {
    Promise.all([
      api.getForm(formId),
      api.listResponses(formId),
      api.getSummary(formId),
      api.getCompletion(formId),
    ])
      .then(([loadedForm, list, data, completionData]) => {
        setForm(loadedForm);
        setResponses(
          list.items.map((item) => ({
            id: item.id,
            formId,
            submittedAt: item.submitted_at,
            answers: {},
          })),
        );
        setSummary(
          data.questions.map((item) => ({
            question: loadedForm.questions.find(
              (question) => question.id === item.question_id,
            ) as Question,
            answeredCount: item.answered_count,
            counts: new Map(
              item.choice_counts.map((count) => [count.value, count.count]),
            ),
            average: item.average ?? undefined,
            latestText: item.latest_text_answer,
          })),
        );
        setCompletion(completionData);
      })
      .catch(() => setForm(null));
  }, [formId]);
  if (form === undefined)
    return <main className="initial-loader">Loading responses…</main>;
  if (!form)
    return (
      <main className="initial-loader">
        This form no longer exists. <Link href="/">Return to your forms</Link>
      </main>
    );
  return (
    <main className="results-page">
      <header className="results-header">
        <Link className="brand-mark" href="/" aria-label="All forms">
          t
        </Link>
        <div>
          <Link href={`/forms/${form.id}/build`}>{form.title}</Link>
          <span>/ Results</span>
        </div>
        <Link className="ghost-button" href={`/forms/${form.id}/build`}>
          Edit form
        </Link>
        <ThemeToggle />
      </header>
      <section className="results-content">
        <div className="results-heading">
          <div>
            <p className="eyebrow">RESPONSES</p>
            <h1>
              {responses.length}{" "}
              {responses.length === 1 ? "response" : "responses"}
            </h1>
            <p>
              {completion
                ? `${completion.completion_rate}% completion · ${completion.partial} partial`
                : "Review what people have shared with you."}
            </p>
          </div>
          <button
            className="ghost-button"
            onClick={() =>
              void api.exportResponses(form.id).then((blob) => {
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.download = `${form.slug}-responses.csv`;
                link.click();
                URL.revokeObjectURL(url);
              })
            }
          >
            Export CSV
          </button>
        </div>
        {responses.length === 0 ? (
          <EmptyResponses form={form} />
        ) : (
          <>
            <section className="summary-grid">
              {summary.map((item) => (
                <QuestionSummary
                  key={item.question.id}
                  question={item.question}
                  responseCount={responses.length}
                  data={item}
                />
              ))}
            </section>
            <section className="response-list-section">
              <div className="section-title">
                <h2>All submissions</h2>
                <span>Newest first</span>
              </div>
              <div className="response-list">
                {responses.map((response, index) => (
                  <button
                    className="response-row"
                    key={response.id}
                    onClick={() =>
                      void api
                        .getResponse(form.id, response.id)
                        .then((detail) =>
                          setSelected(apiResponseToResponse(form.id, detail)),
                        )
                    }
                  >
                    <span className="response-index">
                      {responses.length - index}
                    </span>
                    <div>
                      <strong>Response #{responses.length - index}</strong>
                      <span>{formatDate(response.submittedAt)}</span>
                    </div>
                    <span className="response-chevron">→</span>
                  </button>
                ))}
              </div>
            </section>
          </>
        )}
      </section>
      {selected && (
        <ResponseDetail
          form={form}
          response={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </main>
  );
}

function QuestionSummary({
  question,
  responseCount,
  data,
}: {
  question: Question;
  responseCount: number;
  data: Summary;
}) {
  const countable =
    question.type === "multiple_choice" ||
    question.type === "dropdown" ||
    question.type === "yes_no" ||
    question.type === "rating";
  const options =
    question.type === "yes_no"
      ? ["Yes", "No"]
      : question.type === "rating"
        ? Array.from(
            { length: question.settings.ratingSteps ?? 5 },
            (_, index) => String(index + 1),
          )
        : (question.options ?? []);
  return (
    <article className="summary-card">
      <div className="summary-card-heading">
        <span>Q{question.id.slice(-2)}</span>
        <strong>{question.title || "Untitled question"}</strong>
      </div>
      {countable ? (
        <div className="summary-bars">
          {options.map((option) => {
            const count = data.counts.get(option) ?? 0;
            const percent = responseCount
              ? Math.round((count / responseCount) * 100)
              : 0;
            return (
              <div key={option}>
                <div>
                  <span>{option}</span>
                  <span>
                    {count} · {percent}%
                  </span>
                </div>
                <i>
                  <b style={{ width: `${percent}%` }} />
                </i>
              </div>
            );
          })}
          {question.type === "rating" && data.average !== undefined && (
            <p className="summary-average">
              Average: <strong>{data.average.toFixed(1)}</strong>
            </p>
          )}
        </div>
      ) : (
        <div className="text-summary">
          <strong>{data.answeredCount}</strong>
          <span>{data.answeredCount === 1 ? "answer" : "answers"}</span>
          {data.latestText && <p>“{data.latestText}”</p>}
        </div>
      )}
    </article>
  );
}
function EmptyResponses({ form }: { form: Form }) {
  return (
    <div className="empty-responses">
      <div className="empty-icon">↗</div>
      <h2>Responses will appear here</h2>
      <p>Share your published form to start collecting answers.</p>
      {form.status === "published" ? (
        <code>
          {typeof window === "undefined"
            ? `/f/${form.slug}`
            : `${window.location.origin}/f/${form.slug}`}
        </code>
      ) : (
        <Link className="publish-button" href={`/forms/${form.id}/build`}>
          Publish your form
        </Link>
      )}
    </div>
  );
}
function ResponseDetail({
  form,
  response,
  onClose,
}: {
  form: Form;
  response: Response;
  onClose: () => void;
}) {
  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Response details"
    >
      <article className="response-detail">
        <button className="close-preview" onClick={onClose}>
          Close ×
        </button>
        <p className="eyebrow">SUBMITTED {formatDate(response.submittedAt)}</p>
        <h2>Response details</h2>
        <div>
          {form.questions.map((question, index) => (
            <section key={question.id}>
              <span>{index + 1}</span>
              <h3>{question.title}</h3>
              <ResponseAnswer answer={response.answers[question.id]} />
            </section>
          ))}
        </div>
      </article>
    </div>
  );
}
function ResponseAnswer({ answer }: { answer: Answer | undefined }) {
  if (answer === undefined) return <p>No answer</p>;
  if (
    typeof answer === "object" &&
    answer &&
    "name" in answer &&
    "url" in answer
  )
    return (
      <p>
        <a
          className="response-file-link"
          href={api.fileUrl(answer.url)}
          target="_blank"
          rel="noreferrer"
        >
          Download {answer.name}
        </a>
      </p>
    );
  return <p>{formatAnswer(answer)}</p>;
}
function formatAnswer(answer: Answer): string {
  if (answer === true) return "Yes";
  if (answer === false) return "No";
  if (Array.isArray(answer)) return answer.join(", ");
  if (typeof answer === "object" && answer && "name" in answer)
    return answer.name;
  return String(answer);
}
function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
