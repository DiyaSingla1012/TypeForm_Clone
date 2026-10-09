import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Icon } from "@/components/ui/Icon";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { Toast } from "@/components/ui/Toast";
import { EmptyBuilder } from "@/features/builder/components/EmptyBuilder";
import { FormDesignPanel } from "@/features/builder/components/FormDesignPanel";
import { QuestionCard } from "@/features/builder/components/QuestionCard";
import { QuestionEditor } from "@/features/builder/components/QuestionEditor";
import { QuestionTypeMenu } from "@/features/builder/components/QuestionTypeMenu";
import type { Question } from "@/types/form";
import { makeForm, questions } from "./fixtures";

describe("shared and builder component unit tests", () => {
  it("renders an accessible icon, dismissible toast, and empty builder action", async () => {
    const user = userEvent.setup();
    const dismiss = vi.fn();
    const add = vi.fn();
    const { container } = render(<><Icon name="plus" data-testid="icon" /><Toast toast={{ id: 1, text: "Saved" }} onDismiss={dismiss} /><EmptyBuilder onAdd={add} /></>);

    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden");
    expect(screen.getByRole("status")).toHaveTextContent("Saved");
    await user.click(screen.getByLabelText("Dismiss notification"));
    await user.click(screen.getByRole("button", { name: /add your first question/i }));
    expect(dismiss).toHaveBeenCalledOnce();
    expect(add).toHaveBeenCalledOnce();
  });

  it("persists and applies the creator color-mode preference", async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);
    await user.click(screen.getByRole("button", { name: /switch to dark/i }));
    expect(document.documentElement).toHaveClass("creator-dark");
    expect(window.localStorage.getItem("typeform-builder-creator-theme")).toBe("dark");
    await user.click(screen.getByRole("button", { name: /switch to light/i }));
    expect(document.documentElement).not.toHaveClass("creator-dark");
  });

  it("lists every supported question type and reports the selected one", async () => {
    const user = userEvent.setup();
    const choose = vi.fn();
    render(<QuestionTypeMenu onChoose={choose} />);
    expect(screen.getAllByRole("button")).toHaveLength(10); // nine real types plus Payment placeholder
    await user.click(screen.getByRole("button", { name: /file upload/i }));
    expect(choose).toHaveBeenCalledWith("file_upload");
    expect(screen.getByRole("button", { name: /payment/i })).toBeDisabled();
  });

  it("calls card actions without selecting the card and supports drag events", async () => {
    const user = userEvent.setup();
    const props = { question: questions[0], index: 0, selected: false, onSelect: vi.fn(), onDelete: vi.fn(), onDuplicate: vi.fn(), onDragStart: vi.fn(), onDrop: vi.fn() };
    render(<QuestionCard {...props} />);
    await user.click(screen.getByLabelText("Duplicate question 1"));
    await user.click(screen.getByLabelText("Delete question 1"));
    fireEvent.dragStart(screen.getByRole("article"));
    fireEvent.drop(screen.getByRole("article"));
    expect(props.onDuplicate).toHaveBeenCalledOnce();
    expect(props.onDelete).toHaveBeenCalledOnce();
    expect(props.onSelect).not.toHaveBeenCalled();
    expect(props.onDragStart).toHaveBeenCalledOnce();
    expect(props.onDrop).toHaveBeenCalledOnce();
  });

  it("edits question content, choices, required state, and branching rules", async () => {
    const user = userEvent.setup();
    const update = vi.fn();
    const form = makeForm();
    render(<QuestionEditor question={questions[0]} questions={form.questions} update={update} />);

    fireEvent.change(screen.getByPlaceholderText("Type your question"), { target: { value: "Updated question" } });
    await user.click(screen.getAllByRole("button", { name: "Move choice down" })[0]);
    await user.click(screen.getByRole("button", { name: /add choice/i }));
    await user.click(screen.getByRole("button", { pressed: true }));
    await user.selectOptions(screen.getByLabelText("Option 1"), "question-2");

    expect(update).toHaveBeenCalledWith({ title: "Updated question" });
    expect(update).toHaveBeenCalledWith({ options: ["Option 2", "Option 1"] });
    expect(update).toHaveBeenCalledWith({ options: ["Option 1", "Option 2", "Option 3"] });
    expect(update).toHaveBeenCalledWith({ required: false });
    expect(update).toHaveBeenCalledWith({ settings: { logic: { "Option 1": "question-2" } } });
  });

  it("renders type-specific number and rating controls", async () => {
    const number = { ...questions[0], type: "number" as const, settings: {}, options: undefined };
    const update = vi.fn();
    const { rerender } = render(<QuestionEditor question={number} update={update} />);
    fireEvent.change(screen.getByPlaceholderText("No minimum"), { target: { value: "3" } });
    expect(update).toHaveBeenCalledWith({ settings: { min: 3 } });

    const rating: Question = { ...number, type: "rating", settings: { ratingSteps: 5 } };
    rerender(<QuestionEditor question={rating} update={update} />);
    fireEvent.click(screen.getByRole("button", { name: "10" }));
    expect(update).toHaveBeenCalledWith({ settings: { ratingSteps: 10 } });
  });

  it("updates form theme, appearance, and thank-you content", async () => {
    const user = userEvent.setup();
    const update = vi.fn();
    render(<FormDesignPanel form={makeForm()} update={update} />);
    await user.click(screen.getByRole("button", { name: /midnight/i }));
    fireEvent.change(screen.getByLabelText("Background"), { target: { value: "#000000" } });
    await user.selectOptions(screen.getByLabelText("Font"), "serif");
    fireEvent.change(screen.getByLabelText("Headline"), { target: { value: "All done" } });
    expect(update).toHaveBeenCalledWith({ theme: "ink" });
    expect(update).toHaveBeenCalledWith({ appearance: { background: "#000000" } });
    expect(update).toHaveBeenCalledWith({ appearance: { font: "serif" } });
    expect(update).toHaveBeenCalledWith({ thankYou: { title: "All done", message: "We received your response." } });
  });
});
