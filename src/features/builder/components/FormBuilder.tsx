"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Toast, type ToastMessage } from "@/components/ui/Toast";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import {
  createQuestion,
  type Form,
  type Question,
  type QuestionType,
} from "@/types/form";
import { api } from "@/lib/api";
import { useFormDraft } from "../hooks/useFormDraft";
import { FormPreview } from "./FormPreview";
import { FormDesignPanel } from "./FormDesignPanel";
import { EmptyBuilder } from "./EmptyBuilder";
import { QuestionCard } from "./QuestionCard";
import { QuestionEditor } from "./QuestionEditor";
import { QuestionTypeMenu } from "./QuestionTypeMenu";

export function FormBuilder({ formId }: { formId: string }) {
  const { form, setForm, hydrated } = useFormDraft(formId);
  const [selectedId, setSelectedId] = useState("");
  const [showTypes, setShowTypes] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const questionSaveQueues = useRef<Record<string, Promise<void>>>({});
  const questionSaveVersions = useRef<Record<string, number>>({});
  const [activePanel, setActivePanel] = useState<"question" | "design">(
    "question",
  );
  const selectedIndex = Math.max(
    0,
    form?.questions.findIndex((question) => question.id === selectedId) ?? -1,
  );
  const selectedQuestion = form?.questions[selectedIndex];

  useEffect(() => {
    if (
      form?.questions[0] &&
      !form.questions.some((question) => question.id === selectedId)
    ) {
      setSelectedId(form.questions[0].id);
    }
  }, [form, selectedId]);

  const notify = (text: string) => setToast({ id: Date.now(), text });

  const questionCount = useMemo(
    () => form?.questions.length ?? 0,
    [form?.questions.length],
  );
  const updateForm = (updater: (current: Form) => Form) =>
    setForm((current) => (current ? updater(current) : null));
  const restoreForm = () =>
    void api
      .getForm(formId)
      .then(setForm)
      .catch(() => notify("Could not restore the saved form."));
  const updateQuestion = (id: string, patch: Partial<Question>) => {
    const question = form?.questions.find((item) => item.id === id);
    if (!question) return;
    const next = { ...question, ...patch };
    const version = (questionSaveVersions.current[id] ?? 0) + 1;
    questionSaveVersions.current[id] = version;
    updateForm((current) => ({
      ...current,
      updatedAt: new Date().toISOString(),
      questions: current.questions.map((item) =>
        item.id === id ? next : item,
      ),
    }));
    const previousSave = questionSaveQueues.current[id] ?? Promise.resolve();
    const save = previousSave
      .catch(() => undefined)
      .then(() => api.updateQuestion(next))
      .then((saved) =>
        questionSaveVersions.current[id] === version
          ? updateForm((current) => ({
              ...current,
              questions: current.questions.map((item) =>
                item.id === id ? saved : item,
              ),
            }))
          : undefined,
      )
      .catch((error: Error) => {
        if (questionSaveVersions.current[id] === version) {
          notify(error.message);
          restoreForm();
        }
      });
    questionSaveQueues.current[id] = save;
  };
  const addQuestion = (type: QuestionType) => {
    const question = createQuestion(type);
    void api
      .createQuestion(formId, question)
      .then((created) => {
        updateForm((current) => ({
          ...current,
          updatedAt: new Date().toISOString(),
          questions: [...current.questions, created],
        }));
        setSelectedId(created.id);
      })
      .catch((error: Error) => notify(error.message));
    setShowTypes(false);
    notify(`${question.type.replaceAll("_", " ")} question added`);
  };
  const deleteQuestion = (id: string) => {
    if (!form) return;
    if (!window.confirm("Delete this question? This cannot be undone.")) return;
    const currentIndex = form.questions.findIndex(
      (question) => question.id === id,
    );
    void api
      .deleteQuestion(id)
      .then(() => {
        updateForm((current) => ({
          ...current,
          updatedAt: new Date().toISOString(),
          questionCount: Math.max(0, current.questionCount - 1),
          questions: current.questions.filter((question) => question.id !== id),
        }));
        if (selectedId === id)
          setSelectedId(
            form.questions.filter((question) => question.id !== id)[
              Math.max(0, currentIndex - 1)
            ]?.id ?? "",
          );
        notify("Question deleted");
      })
      .catch((error: Error) => notify(error.message));
  };
  const duplicateQuestion = (id: string) => {
    if (!form) return;
    const sourceIndex = form.questions.findIndex(
      (question) => question.id === id,
    );
    const source = form.questions[sourceIndex];
    const copy = {
      ...source,
      id: crypto.randomUUID(),
      title: `${source.title} (copy)`,
      options: source.options ? [...source.options] : undefined,
    };
    void api
      .createQuestion(formId, copy)
      .then(async (created) => {
        const questions = [...form.questions];
        questions.splice(sourceIndex + 1, 0, created);
        await api.reorderQuestions(
          formId,
          questions.map((question) => question.id),
        );
        updateForm((current) => ({
          ...current,
          updatedAt: new Date().toISOString(),
          questions,
        }));
        setSelectedId(created.id);
        notify("Question duplicated");
      })
      .catch((error: Error) => notify(error.message));
  };
  const reorder = (targetId: string) => {
    if (!draggedId || draggedId === targetId) return;
    if (!form) return;
    const questions = [...form.questions];
    const from = questions.findIndex((question) => question.id === draggedId);
    const to = questions.findIndex((question) => question.id === targetId);
    const [moved] = questions.splice(from, 1);
    questions.splice(to, 0, moved);
    void api
      .reorderQuestions(
        formId,
        questions.map((question) => question.id),
      )
      .then((saved) => {
        updateForm((current) => ({
          ...current,
          updatedAt: new Date().toISOString(),
          questions: saved,
        }));
      })
      .catch((error: Error) => notify(error.message));
    setDraggedId(null);
    notify("Question reordered");
  };

  if (!hydrated)
    return <main className="initial-loader">Loading your workspace…</main>;
  if (!form)
    return (
      <main className="initial-loader">
        This form no longer exists. <Link href="/">Return to your forms</Link>
      </main>
    );

  return (
    <main className="builder-app">
      <header className="topbar">
        <Link href="/" className="brand-mark" aria-label="All forms">
          t
        </Link>
        <div className="crumb">
          <span>My workspace</span>
          <b>/</b>
          <input
            value={form.title}
            aria-label="Form title"
            onChange={(event) =>
              updateForm((current) => ({
                ...current,
                title: event.target.value,
              }))
            }
            onBlur={() =>
              void api
                .updateForm(form.id, { title: form.title || "Untitled form" })
                .then(setForm)
                .catch((error: Error) => {
                  notify(error.message);
                  restoreForm();
                })
            }
          />
        </div>
        <div className="top-actions">
          <Link className="ghost-button" href={`/forms/${form.id}/results`}>
            Results <span className="response-badge">{form.responseCount}</span>
          </Link>
          <button
            className="ghost-button"
            onClick={() => setShowPreview(true)}
            disabled={!selectedQuestion}
          >
            <Icon name="eye" /> Preview
          </button>
          <button
            className="publish-button"
            onClick={() => {
              const status =
                form.status === "published" ? "draft" : "published";
              void api
                .setPublication(form.id, status)
                .then(setForm)
                .then(() =>
                  notify(
                    status === "draft"
                      ? "Form moved to draft"
                      : "Form published",
                  ),
                )
                .catch((error: Error) => notify(error.message));
            }}
          >
            {form.status === "published" ? "Unpublish" : "Publish"}
          </button>
          <ThemeToggle />
          <button className="avatar" aria-label="Account">
            D
          </button>
        </div>
      </header>
      <div className="builder-body">
        <aside className="question-sidebar">
          <div className="sidebar-heading">
            <span>CONTENT</span>
            <span>{questionCount}</span>
          </div>
          <div className="question-list">
            {form.questions.map((question, index) => (
              <QuestionCard
                key={question.id}
                question={question}
                index={index}
                selected={question.id === selectedId}
                onSelect={() => setSelectedId(question.id)}
                onDelete={() => deleteQuestion(question.id)}
                onDuplicate={() => duplicateQuestion(question.id)}
                onDragStart={() => setDraggedId(question.id)}
                onDrop={() => reorder(question.id)}
              />
            ))}
          </div>
          <div className="add-wrap">
            <button
              className="add-question"
              onClick={() => setShowTypes((open) => !open)}
            >
              <Icon name="plus" /> Add question
            </button>
            {showTypes && <QuestionTypeMenu onChoose={addQuestion} />}
          </div>
        </aside>
        <section className="canvas">
          {selectedQuestion ? (
            <>
              <div className="canvas-label">
                <span>QUESTION {selectedIndex + 1}</span>
                <span>
                  {selectedQuestion.required ? "REQUIRED" : "OPTIONAL"}
                </span>
              </div>
              <QuestionEditor
                question={selectedQuestion}
                questions={form.questions}
                update={(patch) => updateQuestion(selectedQuestion.id, patch)}
              />
            </>
          ) : (
            <EmptyBuilder onAdd={() => setShowTypes(true)} />
          )}
        </section>
        <aside className="right-sidebar">
          <div className="right-tabs">
            <button
              className={activePanel === "question" ? "active" : ""}
              onClick={() => setActivePanel("question")}
            >
              Question
            </button>
            <button
              className={activePanel === "design" ? "active" : ""}
              onClick={() => setActivePanel("design")}
            >
              Design
            </button>
          </div>
          {activePanel === "design" ? (
            <FormDesignPanel
              form={form}
              update={(patch) => {
                const next = {
                  ...form,
                  ...patch,
                  updatedAt: new Date().toISOString(),
                };
                setForm(next);
                void api
                  .updateExperience(next)
                  .then((saved) =>
                    setForm((current) =>
                      current
                        ? {
                            ...current,
                            theme: saved.theme,
                            thankYou: {
                              title: saved.thank_you_title,
                              message: saved.thank_you_message,
                            },
                          }
                        : current,
                    ),
                  )
                  .catch((error: Error) => {
                    notify(error.message);
                    restoreForm();
                  });
              }}
            />
          ) : selectedQuestion ? (
            <div className="inspector">
              <span className="section-kicker">QUESTION TYPE</span>
              <div className="type-display">
                {selectedQuestion.type.replaceAll("_", " ")}
                <Icon name="chevron" />
              </div>
              <span className="section-kicker">QUESTION SETTINGS</span>
              <button className="coming-soon">
                Logic jumps <small>Coming soon</small>
              </button>
              <button className="coming-soon">
                Answer recall <small>Coming soon</small>
              </button>
              <span className="section-kicker future-section">FORM TOOLS</span>
              <button className="coming-soon">
                Integrations &amp; webhooks <small>Coming soon</small>
              </button>
              <button className="coming-soon">
                Team collaboration &amp; sharing <small>Coming soon</small>
              </button>
            </div>
          ) : (
            <div className="empty-inspector">
              Select or add a question to edit its settings.
            </div>
          )}
        </aside>
      </div>
      {showPreview && selectedQuestion && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Form preview"
        >
          <div className="preview-modal">
            <button
              className="close-preview"
              onClick={() => setShowPreview(false)}
            >
              Close preview ×
            </button>
            <FormPreview form={form} initialIndex={selectedIndex} />
          </div>
        </div>
      )}
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </main>
  );
}
