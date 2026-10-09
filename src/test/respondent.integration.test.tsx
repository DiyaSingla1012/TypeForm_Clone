import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RespondentFlow } from "@/features/respondent/components/RespondentFlow";
import { makeForm, questions } from "./fixtures";

const apiMock = vi.hoisted(() => ({ savePartial: vi.fn(), submitResponse: vi.fn(), uploadFile: vi.fn() }));
vi.mock("@/lib/api", () => ({ api: apiMock }));

describe("respondent flow integration", () => {
  beforeEach(() => {
    apiMock.savePartial.mockResolvedValue({ partial_id: "partial-1" });
    apiMock.submitResponse.mockResolvedValue({ thank_you_title: "Thank you!", thank_you_message: "Saved" });
  });

  it("validates, saves progress, follows a choice branch, submits, then shows thank-you only after submission", async () => {
    const user = userEvent.setup();
    const branchForm = makeForm({
      status: "published",
      questions: [
        { ...questions[0], settings: { logic: { "Option 2": "question-2" } } },
        questions[1],
      ],
    });
    render(<RespondentFlow form={branchForm} />);

    await user.click(screen.getByRole("button", { name: /^ok/i }));
    expect(screen.getByRole("alert")).toHaveTextContent("Please answer this question");
    expect(screen.queryByText("Thank you!")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /b option 2/i }));
    await user.click(screen.getByRole("button", { name: /^ok/i }));
    await waitFor(() => expect(apiMock.savePartial).toHaveBeenCalledWith(branchForm.slug, { "question-1": "Option 2" }, undefined));
    expect(screen.getByRole("heading", { name: /your email/i })).toBeInTheDocument();

    await user.type(screen.getByRole("textbox"), "person@example.com");
    await user.click(screen.getByRole("button", { name: /submit/i }));
    await waitFor(() => expect(apiMock.submitResponse).toHaveBeenCalledWith(branchForm.slug, { "question-1": "Option 2", "question-2": "person@example.com" }, "partial-1"));
    expect(screen.getByRole("heading", { name: "Thank you!" })).toBeInTheDocument();
  });

  it("shows server errors without losing the question", async () => {
    const user = userEvent.setup();
    apiMock.submitResponse.mockRejectedValueOnce(new Error("Service unavailable"));
    render(<RespondentFlow form={makeForm({ questions: [questions[1]] })} />);
    await user.type(screen.getByRole("textbox"), "person@example.com");
    await user.click(screen.getByRole("button", { name: /submit/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Service unavailable");
    expect(screen.getByRole("heading", { name: /your email/i })).toBeInTheDocument();
  });
});
