import { createForm, type Form } from "@/types/form";

const FORMS_KEY = "typeform-builder-forms";
const LEGACY_DRAFT_KEY = "typeform-builder-draft";

export function getStoredForms(): Form[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(FORMS_KEY);
  if (raw) {
    try {
      return (JSON.parse(raw) as Form[]).map(normalizeForm);
    } catch {
      window.localStorage.removeItem(FORMS_KEY);
    }
  }

  const legacy = window.localStorage.getItem(LEGACY_DRAFT_KEY);
  if (legacy) {
    try {
      const parsed = JSON.parse(legacy) as Partial<Form>;
      const migrated = normalizeForm({ ...createForm(parsed.title ?? "Untitled form"), ...parsed });
      setStoredForms([migrated]);
      return [migrated];
    } catch {
      window.localStorage.removeItem(LEGACY_DRAFT_KEY);
    }
  }
  return [];
}

export function setStoredForms(forms: Form[]) {
  window.localStorage.setItem(FORMS_KEY, JSON.stringify(forms));
}

export function normalizeForm(form: Partial<Form>): Form {
  const fallback = createForm(form.title ?? "Untitled form");
  return {
    ...fallback,
    ...form,
    questions: (form.questions ?? fallback.questions).map((question) => ({ ...question, settings: question.settings ?? { placeholder: "Type your answer here..." } })),
    status: form.status ?? "draft",
    slug: form.slug ?? `form-${(form.id ?? fallback.id).slice(0, 8)}`,
    responseCount: form.responseCount ?? 0,
    createdAt: form.createdAt ?? fallback.createdAt,
    updatedAt: form.updatedAt ?? fallback.updatedAt
    ,theme: form.theme ?? fallback.theme
    ,thankYou: form.thankYou ?? fallback.thankYou
  };
}
