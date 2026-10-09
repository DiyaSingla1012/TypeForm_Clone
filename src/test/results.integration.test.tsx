import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ResultsView } from "@/features/results/components/ResultsView";
import { makeForm } from "./fixtures";

const apiMock = vi.hoisted(() => ({ getForm: vi.fn(), listResponses: vi.fn(), getSummary: vi.fn(), getCompletion: vi.fn(), getResponse: vi.fn(), exportResponses: vi.fn(), fileUrl: vi.fn((url: string) => `http://api.test${url}`) }));
vi.mock("@/lib/api", () => ({ api: apiMock, apiResponseToResponse: (formId: string, response: { id: string; submitted_at: string; answers: { question_id: string; value: unknown }[] }) => ({ id: response.id, formId, submittedAt: response.submitted_at, answers: Object.fromEntries(response.answers.map((answer) => [answer.question_id, answer.value])) }) }));
vi.mock("next/link", () => ({ default: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a> }));

describe("results integration", () => {
  beforeEach(() => {
    const form = makeForm();
    apiMock.getForm.mockResolvedValue(form);
    apiMock.listResponses.mockResolvedValue({ items: [{ id: "response-1", submitted_at: "2026-01-02T12:00:00Z", answer_count: 2 }], total: 1 });
    apiMock.getSummary.mockResolvedValue({ questions: form.questions.map((question, index) => ({ question_id: question.id, answered_count: 1, choice_counts: index === 0 ? [{ value: "Option 1", count: 1, percentage: 100 }] : [], average: null, latest_text_answer: index === 1 ? "person@example.com" : null })) });
    apiMock.getCompletion.mockResolvedValue({ started: 2, completed: 1, partial: 1, completion_rate: 50 });
    apiMock.getResponse.mockResolvedValue({ id: "response-1", submitted_at: "2026-01-02T12:00:00Z", answers: [{ question_id: "question-1", value: "Option 1" }, { question_id: "question-2", value: "person@example.com" }] });
  });

  it("loads summaries and opens an individual persisted response", async () => {
    const user = userEvent.setup();
    render(<ResultsView formId="form-1" />);
    expect(await screen.findByRole("heading", { name: /1 response/i })).toBeInTheDocument();
    expect(screen.getByText("50% completion · 1 partial")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /response #1/i }));
    expect(await screen.findByRole("dialog", { name: "Response details" })).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Response details" })).toHaveTextContent("Option 1");
    expect(apiMock.getResponse).toHaveBeenCalledWith("form-1", "response-1");
  });

  it("renders the empty published-form share state", async () => {
    apiMock.getForm.mockResolvedValueOnce(makeForm({ status: "published" }));
    apiMock.listResponses.mockResolvedValueOnce({ items: [], total: 0 });
    render(<ResultsView formId="form-1" />);
    expect(await screen.findByText("Responses will appear here")).toBeInTheDocument();
    expect(screen.getByText(/\/f\/customer-feedback/)).toBeInTheDocument();
  });
});
