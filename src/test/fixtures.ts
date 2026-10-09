import type { Form, Question } from "@/types/form";

export const questions: Question[] = [
  {
    id: "question-1",
    type: "multiple_choice",
    title: "Which option?",
    description: "Choose one answer.",
    required: true,
    options: ["Option 1", "Option 2"],
    settings: {},
  },
  {
    id: "question-2",
    type: "email",
    title: "Your email",
    description: "",
    required: true,
    settings: { placeholder: "name@example.com" },
  },
];

export function makeForm(overrides: Partial<Form> = {}): Form {
  return {
    id: "form-1",
    title: "Customer feedback",
    slug: "customer-feedback",
    status: "draft",
    questionCount: questions.length,
    responseCount: 2,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    theme: "blue",
    appearance: {},
    thankYou: { title: "Thank you!", message: "We received your response." },
    questions: questions.map((question) => ({ ...question, settings: { ...question.settings }, options: question.options ? [...question.options] : undefined })),
    ...overrides,
  };
}
