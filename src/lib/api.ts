import type {
  Answer,
  Form,
  FormAppearance,
  FormTheme,
  Question,
  QuestionType,
  Response,
} from "@/types/form";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

type ApiQuestion = {
  id: string;
  position: number;
  type: QuestionType;
  title: string;
  description: string;
  required: boolean;
  settings: Record<string, unknown>;
  options: string[];
};
type ApiForm = {
  id: string;
  title: string;
  slug: string;
  status: "draft" | "published";
  theme: FormTheme;
  appearance?: FormAppearance;
  thank_you_title: string;
  thank_you_message: string;
  created_at: string;
  updated_at: string;
  question_count: number;
  response_count: number;
  questions?: ApiQuestion[];
};
type ApiResponseList = {
  items: { id: string; submitted_at: string; answer_count: number }[];
  total: number;
};
type ApiSummary = {
  total_responses: number;
  questions: {
    question_id: string;
    question_type: QuestionType;
    title: string;
    response_count: number;
    answered_count: number;
    choice_counts: { value: string; count: number; percentage: number }[];
    average: number | null;
    latest_text_answer: string | null;
  }[];
};
type ApiExperience = {
  theme: FormTheme;
  appearance: FormAppearance;
  thank_you_title: string;
  thank_you_message: string;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`;
  let response: globalThis.Response;
  try {
    const headers =
      init?.body instanceof FormData
        ? init?.headers
        : { "Content-Type": "application/json", ...init?.headers };
    response = await fetch(url, { ...init, headers });
  } catch (error) {
    const reason =
      error instanceof Error ? error.message : "Network request failed";
    throw new Error(
      `${init?.method ?? "GET"} ${url} could not reach the API: ${reason}`,
    );
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      detail?: string;
    } | null;
    throw new Error(body?.detail ?? "Something went wrong. Please try again.");
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

function toQuestion(question: ApiQuestion): Question {
  return {
    id: question.id,
    type: question.type,
    title: question.title,
    description: question.description,
    required: question.required,
    settings: question.settings,
    options: question.options,
  };
}

function toForm(form: ApiForm): Form {
  return {
    id: form.id,
    title: form.title,
    slug: form.slug,
    status: form.status,
    theme: form.theme,
    appearance: form.appearance ?? {},
    thankYou: { title: form.thank_you_title, message: form.thank_you_message },
    createdAt: form.created_at,
    updatedAt: form.updated_at,
    questionCount: form.question_count,
    responseCount: form.response_count,
    questions: (form.questions ?? [])
      .sort((a, b) => a.position - b.position)
      .map(toQuestion),
  };
}

function questionPayload(question: Question) {
  return {
    type: question.type,
    title: question.title,
    description: question.description,
    required: question.required,
    settings: question.settings,
    options: question.options ?? [],
  };
}

export const api = {
  async listForms() {
    return (await request<ApiForm[]>("/api/forms")).map(toForm);
  },
  async getForm(id: string) {
    return toForm(await request<ApiForm>(`/api/forms/${id}`));
  },
  async createForm(title = "Untitled form") {
    return toForm(
      await request<ApiForm>("/api/forms", {
        method: "POST",
        body: JSON.stringify({ title }),
      }),
    );
  },
  async updateForm(id: string, patch: Partial<Pick<Form, "title">>) {
    return toForm(
      await request<ApiForm>(`/api/forms/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    );
  },
  async updateExperience(form: Form) {
    return request<ApiExperience>(`/api/forms/${form.id}/experience`, {
      method: "PATCH",
      body: JSON.stringify({
        theme: form.theme,
        appearance: form.appearance,
        thank_you_title: form.thankYou.title,
        thank_you_message: form.thankYou.message,
      }),
    });
  },
  async deleteForm(id: string) {
    return request<void>(`/api/forms/${id}`, { method: "DELETE" });
  },
  async duplicateForm(id: string) {
    return toForm(
      await request<ApiForm>(`/api/forms/${id}/duplicate`, { method: "POST" }),
    );
  },
  async setPublication(id: string, status: Form["status"]) {
    return toForm(
      await request<ApiForm>(`/api/forms/${id}/publication`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    );
  },
  async createQuestion(formId: string, question: Question) {
    return toQuestion(
      await request<ApiQuestion>(`/api/forms/${formId}/questions`, {
        method: "POST",
        body: JSON.stringify(questionPayload(question)),
      }),
    );
  },
  async updateQuestion(question: Question) {
    return toQuestion(
      await request<ApiQuestion>(`/api/questions/${question.id}`, {
        method: "PATCH",
        body: JSON.stringify(questionPayload(question)),
      }),
    );
  },
  async deleteQuestion(id: string) {
    return request<void>(`/api/questions/${id}`, { method: "DELETE" });
  },
  async reorderQuestions(formId: string, questionIds: string[]) {
    return (
      await request<ApiQuestion[]>(`/api/forms/${formId}/questions/reorder`, {
        method: "PUT",
        body: JSON.stringify({ question_ids: questionIds }),
      })
    ).map(toQuestion);
  },
  async getPublicForm(slug: string) {
    return toForm(await request<ApiForm>(`/api/public/forms/${slug}`));
  },
  async submitResponse(
    slug: string,
    answers: Record<string, Answer>,
    partialId?: string,
  ) {
    return request<{ thank_you_title: string; thank_you_message: string }>(
      `/api/public/forms/${slug}/responses`,
      {
        method: "POST",
        body: JSON.stringify({ answers, partial_id: partialId }),
      },
    );
  },
  async savePartial(
    slug: string,
    answers: Record<string, Answer>,
    partialId?: string,
  ) {
    return request<{ partial_id: string }>(
      `/api/public/forms/${slug}/partials`,
      {
        method: "POST",
        body: JSON.stringify({ answers, partial_id: partialId }),
      },
    );
  },
  async uploadFile(slug: string, file: File) {
    const data = new FormData();
    data.append("file", file);
    return request<{ id: string; name: string; url: string }>(
      `/api/public/forms/${slug}/uploads`,
      { method: "POST", body: data, headers: {} },
    );
  },
  async getCompletion(formId: string) {
    return request<{
      started: number;
      completed: number;
      partial: number;
      completion_rate: number;
    }>(`/api/forms/${formId}/completion`);
  },
  fileUrl(path: string) {
    return `${API_BASE}${path}`;
  },
  async exportResponses(formId: string) {
    const response = await fetch(
      `${API_BASE}/api/forms/${formId}/export/responses.csv`,
    );
    if (!response.ok) throw new Error("Could not export responses.");
    return response.blob();
  },
  async listResponses(formId: string) {
    return request<ApiResponseList>(`/api/forms/${formId}/responses`);
  },
  async getResponse(formId: string, responseId: string) {
    return request<{
      id: string;
      submitted_at: string;
      answers: { question_id: string; value: Answer }[];
    }>(`/api/forms/${formId}/responses/${responseId}`);
  },
  async getSummary(formId: string) {
    return request<ApiSummary>(`/api/forms/${formId}/results/summary`);
  },
};

export function apiResponseToResponse(
  formId: string,
  response: {
    id: string;
    submitted_at: string;
    answers: { question_id: string; value: Answer }[];
  },
): Response {
  return {
    id: response.id,
    formId,
    submittedAt: response.submitted_at,
    answers: Object.fromEntries(
      response.answers.map((answer) => [answer.question_id, answer.value]),
    ),
  };
}
