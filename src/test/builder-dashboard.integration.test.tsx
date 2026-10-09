import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type React from "react";
import { describe, expect, it, vi } from "vitest";
import { FormBuilder } from "@/features/builder/components/FormBuilder";
import { FormsDashboard } from "@/features/forms/components/FormsDashboard";
import { makeForm, questions } from "./fixtures";

const routerMock = vi.hoisted(() => ({ push: vi.fn() }));
const builderApiMock = vi.hoisted(() => ({
  getForm: vi.fn(), updateForm: vi.fn(), updateQuestion: vi.fn(), createQuestion: vi.fn(), deleteQuestion: vi.fn(), reorderQuestions: vi.fn(), setPublication: vi.fn(), updateExperience: vi.fn(),
}));
const formsActions = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn(), remove: vi.fn(), duplicate: vi.fn(), setPublication: vi.fn() }));

vi.mock("next/link", () => ({ default: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a> }));
vi.mock("next/navigation", () => ({ useRouter: () => routerMock }));
vi.mock("@/lib/api", () => ({ api: builderApiMock }));
vi.mock("@/features/builder/hooks/useFormDraft", async () => {
  const React = await import("react");
  return { useFormDraft: () => { const [form, setForm] = React.useState(makeForm()); return { form, setForm, hydrated: true }; } };
});
vi.mock("@/features/forms/hooks/useForms", () => ({
  useForms: () => ({ forms: [makeForm()], hydrated: true, ...formsActions }),
}));

describe("creator workflow integration", () => {
  it("edits a builder title, adds a question, publishes, opens preview, and deletes with confirmation", async () => {
    const user = userEvent.setup();
    const created = { ...questions[1], id: "created-question", type: "number" as const, title: "Your number question", settings: { placeholder: "Enter a number" } };
    builderApiMock.updateForm.mockResolvedValue(makeForm({ title: "Renamed form" }));
    builderApiMock.createQuestion.mockResolvedValue(created);
    builderApiMock.setPublication.mockResolvedValue(makeForm({ status: "published" }));
    builderApiMock.deleteQuestion.mockResolvedValue(undefined);
    vi.stubGlobal("confirm", vi.fn(() => true));
    render(<FormBuilder formId="form-1" />);

    const title = screen.getByLabelText("Form title");
    await user.clear(title);
    await user.type(title, "Renamed form");
    fireEvent.blur(title);
    await waitFor(() => expect(builderApiMock.updateForm).toHaveBeenCalledWith("form-1", { title: "Renamed form" }));

    await user.click(screen.getByRole("button", { name: /add question/i }));
    await user.click(screen.getByRole("button", { name: /number/i }));
    await waitFor(() => expect(builderApiMock.createQuestion).toHaveBeenCalled());
    expect(await screen.findByDisplayValue("Your number question")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Publish" }));
    await waitFor(() => expect(builderApiMock.setPublication).toHaveBeenCalledWith("form-1", "published"));
    await user.click(screen.getByRole("button", { name: "Preview" }));
    expect(await screen.findByRole("dialog", { name: "Form preview" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Close preview ×" }));

    await user.click(screen.getByLabelText("Delete question 1"));
    await waitFor(() => expect(builderApiMock.deleteQuestion).toHaveBeenCalledWith("question-1"));
  });

  it("manages dashboard forms: create, rename, publish, copy, duplicate, and delete", async () => {
    const user = userEvent.setup();
    const form = makeForm();
    formsActions.create.mockResolvedValue(form);
    formsActions.update.mockResolvedValue(makeForm({ title: "New name" }));
    formsActions.setPublication.mockResolvedValue(makeForm({ status: "published" }));
    formsActions.duplicate.mockResolvedValue(makeForm({ id: "copy-1", title: "Customer feedback (copy)" }));
    formsActions.remove.mockResolvedValue(undefined);
    vi.stubGlobal("confirm", vi.fn(() => true));
    render(<FormsDashboard />);

    await user.click(screen.getByRole("button", { name: /create a form/i }));
    await waitFor(() => expect(routerMock.push).toHaveBeenCalledWith("/forms/form-1/build"));
    await user.click(screen.getByRole("button", { name: "Rename" }));
    await user.clear(screen.getByRole("textbox"));
    await user.type(screen.getByRole("textbox"), "New name");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(formsActions.update).toHaveBeenCalledWith("form-1", { title: "New name" }));
    await user.click(screen.getByRole("button", { name: "Publish" }));
    await waitFor(() => expect(formsActions.setPublication).toHaveBeenCalledWith("form-1", "published"));
    await user.click(screen.getByRole("button", { name: "Duplicate" }));
    await waitFor(() => expect(formsActions.duplicate).toHaveBeenCalledWith("form-1"));
    await user.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(formsActions.remove).toHaveBeenCalledWith("form-1"));
  });
});
