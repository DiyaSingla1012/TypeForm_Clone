"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Toast, type ToastMessage } from "@/components/ui/Toast";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import type { Form } from "@/types/form";
import { useForms } from "../hooks/useForms";

export function FormsDashboard() {
  const router = useRouter();
  const { forms, hydrated, create, update, remove, duplicate, setPublication } =
    useForms();
  const [renaming, setRenaming] = useState<Form | null>(null);
  const [name, setName] = useState("");
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const notify = (text: string) => setToast({ id: Date.now(), text });

  const newForm = async () => {
    const form = await create();
    router.push(`/forms/${form.id}/build`);
  };
  const beginRename = (form: Form) => {
    setRenaming(form);
    setName(form.title);
  };
  const saveRename = async () => {
    if (!renaming) return;
    try {
      await update(renaming.id, { title: name.trim() || "Untitled form" });
      setRenaming(null);
      notify("Form renamed");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not rename form.");
    }
  };
  const copyLink = async (form: Form) => {
    const link = `${window.location.origin}/f/${form.slug}`;
    try {
      await navigator.clipboard.writeText(link);
      notify("Share link copied");
    } catch {
      notify("Share link ready: copy it from your browser address bar");
    }
  };

  if (!hydrated)
    return <main className="initial-loader">Loading your forms…</main>;

  return (
    <main className="dashboard">
      <header className="dashboard-header">
        <Link href="/" className="brand-mark">
          t
        </Link>
        <span>My workspace</span>
        <ThemeToggle />
        <button className="avatar" aria-label="Account">
          D
        </button>
      </header>
      <section className="dashboard-content">
        <div className="dashboard-title">
          <div>
            <p className="eyebrow">WORKSPACE</p>
            <h1>My forms</h1>
            <p>Create conversational forms that people enjoy answering.</p>
          </div>
          <button className="new-form-button" onClick={() => void newForm()}>
            <Icon name="plus" /> Create a form
          </button>
        </div>
        {forms.length === 0 ? (
          <EmptyForms onCreate={() => void newForm()} />
        ) : (
          <div className="forms-grid">
            {forms.map((form) => (
              <FormCard
                key={form.id}
                form={form}
                onRename={() => beginRename(form)}
                onDuplicate={() => {
                  void duplicate(form.id)
                    .then((copy) => {
                      notify("Form duplicated");
                      router.push(`/forms/${copy.id}/build`);
                    })
                    .catch((error: Error) => notify(error.message));
                }}
                onDelete={() => {
                  if (
                    window.confirm(
                      `Delete “${form.title}”? This will permanently remove the form and its responses.`,
                    )
                  )
                    void remove(form.id)
                      .then(() => notify("Form deleted"))
                      .catch((error: Error) => notify(error.message));
                }}
                onPublish={() => {
                  const published = form.status !== "published";
                  void setPublication(
                    form.id,
                    published ? "published" : "draft",
                  )
                    .then(() =>
                      notify(
                        published ? "Form published" : "Form moved to draft",
                      ),
                    )
                    .catch((error: Error) => notify(error.message));
                }}
                onShare={() => copyLink(form)}
              />
            ))}
          </div>
        )}
      </section>
      {renaming && (
        <RenameDialog
          value={name}
          onChange={setName}
          onCancel={() => setRenaming(null)}
          onSave={() => void saveRename()}
        />
      )}
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </main>
  );
}

function FormCard({
  form,
  onRename,
  onDuplicate,
  onDelete,
  onPublish,
  onShare,
}: {
  form: Form;
  onRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onPublish: () => void;
  onShare: () => void;
}) {
  return (
    <article className="form-card">
      <Link href={`/forms/${form.id}/build`} className="form-card-main">
        <div className="form-card-art">
          <span>{form.title.slice(0, 1).toUpperCase()}</span>
        </div>
        <div className="form-card-title">
          <h2>{form.title}</h2>
          <span className={`status ${form.status}`}>{form.status}</span>
        </div>
        <div className="form-meta">
          <span>
            {form.questionCount}{" "}
            {form.questionCount === 1 ? "question" : "questions"}
          </span>
          <span>{form.responseCount} responses</span>
        </div>
      </Link>
      <div className="form-card-actions">
        <button onClick={onPublish}>
          {form.status === "published" ? "Unpublish" : "Publish"}
        </button>
        {form.status === "published" && (
          <button onClick={onShare}>Copy link</button>
        )}
        <Link href={`/forms/${form.id}/results`}>Results</Link>
        <button onClick={onRename}>Rename</button>
        <button onClick={onDuplicate}>Duplicate</button>
        <button className="danger" onClick={onDelete}>
          Delete
        </button>
      </div>
    </article>
  );
}

function EmptyForms({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="empty-forms">
      <div className="empty-icon">
        <Icon name="plus" />
      </div>
      <h2>Your workspace is ready</h2>
      <p>
        Start with a blank form, then shape every question around your audience.
      </p>
      <button className="new-form-button" onClick={onCreate}>
        <Icon name="plus" /> Create your first form
      </button>
    </div>
  );
}

function RenameDialog({
  value,
  onChange,
  onCancel,
  onSave,
}: {
  value: string;
  onChange: (value: string) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Rename form"
    >
      <div className="rename-dialog">
        <h2>Rename form</h2>
        <input
          autoFocus
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") onSave();
            if (event.key === "Escape") onCancel();
          }}
        />
        <div>
          <button className="ghost-button" onClick={onCancel}>
            Cancel
          </button>
          <button className="publish-button" onClick={onSave}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
