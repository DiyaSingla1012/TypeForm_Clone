import type { Response } from "@/types/form";
import { getStoredForms, setStoredForms } from "@/features/forms/lib/formsStorage";

const RESPONSES_KEY = "typeform-builder-responses";

export function saveResponse(response: Response) {
  const stored = getResponses();
  window.localStorage.setItem(RESPONSES_KEY, JSON.stringify([response, ...stored]));
  const forms = getStoredForms();
  setStoredForms(forms.map((form) => form.id === response.formId ? { ...form, responseCount: form.responseCount + 1, updatedAt: new Date().toISOString() } : form));
}

export function getResponses(): Response[] {
  try {
    return JSON.parse(window.localStorage.getItem(RESPONSES_KEY) ?? "[]") as Response[];
  } catch {
    return [];
  }
}
