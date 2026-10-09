import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AnswerField } from "@/features/respondent/components/AnswerField";
import { FormPreview } from "@/features/builder/components/FormPreview";
import { makeForm, questions } from "./fixtures";

describe("respondent and preview component unit tests", () => {
  it("captures choice, dropdown, yes/no, text, rating, and file answers", async () => {
    const user = userEvent.setup();
    const change = vi.fn();
    const upload = vi.fn().mockResolvedValue(undefined);
    const { rerender } = render(<AnswerField question={questions[0]} value={undefined} onChange={change} onAdvance={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /a option 1/i }));
    expect(change).toHaveBeenCalledWith("Option 1");

    rerender(<AnswerField question={{ ...questions[0], type: "dropdown" }} value={undefined} onChange={change} onAdvance={vi.fn()} />);
    await user.selectOptions(screen.getByRole("combobox"), "Option 2");
    expect(change).toHaveBeenCalledWith("Option 2");

    rerender(<AnswerField question={{ ...questions[0], type: "yes_no", options: undefined }} value={undefined} onChange={change} onAdvance={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /y yes/i }));
    expect(change).toHaveBeenCalledWith(true);

    rerender(<AnswerField question={{ ...questions[0], type: "rating", options: undefined, settings: { ratingSteps: 5 } }} value={undefined} onChange={change} onAdvance={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "4" }));
    expect(change).toHaveBeenCalledWith(4);

    rerender(<AnswerField question={{ ...questions[0], type: "file_upload", options: undefined }} value={undefined} onChange={change} onAdvance={vi.fn()} onUpload={upload} />);
    const file = new File(["proof"], "proof.txt", { type: "text/plain" });
    await user.upload(screen.getByLabelText("Upload a file"), file);
    expect(upload).toHaveBeenCalledWith(file);
  });

  it("advances a text question with Enter and a long-text question with Control+Enter", async () => {
    const advance = vi.fn();
    const text = { ...questions[1], type: "short_text" as const };
    const { rerender } = render(<AnswerField question={text} value="" onChange={vi.fn()} onAdvance={advance} />);
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });
    expect(advance).toHaveBeenCalledOnce();

    rerender(<AnswerField question={{ ...text, type: "long_text" }} value="" onChange={vi.fn()} onAdvance={advance} />);
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter", ctrlKey: true });
    expect(advance).toHaveBeenCalledTimes(2);
  });

  it("renders a themed preview and steps through questions without showing thank-you content", async () => {
    const user = userEvent.setup();
    const form = makeForm({ theme: "ink" });
    render(<FormPreview form={form} initialIndex={0} />);
    expect(screen.getByText("1 of 2")).toBeInTheDocument();
    expect(screen.getByText("Which option?")).toBeInTheDocument();
    expect(screen.queryByText(form.thankYou.title)).not.toBeInTheDocument();
    expect(document.querySelector(".preview-shell")).toHaveClass("preview-theme-ink");
    await user.click(screen.getByRole("button", { name: /ok/i }));
    expect(screen.getByText("2 of 2")).toBeInTheDocument();
    expect(screen.getByText("Your email")).toBeInTheDocument();
  });
});
