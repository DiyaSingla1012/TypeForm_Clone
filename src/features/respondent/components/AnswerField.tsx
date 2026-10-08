import type { Answer, Question } from "@/types/form";

type Props = {
  question: Question;
  value: Answer | undefined;
  onChange: (value: Answer) => void;
  onAdvance: () => void;
  onUpload?: (file: File) => Promise<void>;
};

export function AnswerField({
  question,
  value,
  onChange,
  onAdvance,
  onUpload,
}: Props) {
  const textValue =
    typeof value === "string" || typeof value === "number" ? String(value) : "";
  if (question.type === "multiple_choice")
    return (
      <div className="flow-options">
        {(question.options ?? []).map((option, index) => (
          <button
            key={`${option}-${index}`}
            className={value === option ? "selected" : ""}
            onClick={() => onChange(option)}
          >
            <b className="flow-option-key">{String.fromCharCode(65 + index)}</b>
            <span className="flow-option-text">{option}</span>
          </button>
        ))}
        {question.settings.allowOther && (
          <button
            className={value === "Other" ? "selected" : ""}
            onClick={() => onChange("Other")}
          >
            <b className="flow-option-key">O</b>
            <span className="flow-option-text">Other</span>
          </button>
        )}
      </div>
    );
  if (question.type === "dropdown")
    return (
      <select
        className="flow-select"
        value={textValue}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Choose an option</option>
        {(question.options ?? []).map((option) => (
          <option key={option}>{option}</option>
        ))}
        {question.settings.allowOther && <option>Other</option>}
      </select>
    );
  if (question.type === "yes_no")
    return (
      <div className="flow-options yes-no">
        <button
          className={value === true ? "selected" : ""}
          onClick={() => onChange(true)}
        >
          <b className="flow-option-key">Y</b>
          <span className="flow-option-text">Yes</span>
        </button>
        <button
          className={value === false ? "selected" : ""}
          onClick={() => onChange(false)}
        >
          <b className="flow-option-key">N</b>
          <span className="flow-option-text">No</span>
        </button>
      </div>
    );
  if (question.type === "rating")
    return (
      <div className="flow-rating">
        {Array.from(
          { length: question.settings.ratingSteps ?? 5 },
          (_, index) => index + 1,
        ).map((rating) => (
          <button
            key={rating}
            className={value === rating ? "selected" : ""}
            onClick={() => onChange(rating)}
          >
            {rating}
          </button>
        ))}
        <div>
          <span>{question.settings.ratingLowLabel}</span>
          <span>{question.settings.ratingHighLabel}</span>
        </div>
      </div>
    );
  if (question.type === "file_upload")
    return (
      <div className="flow-upload">
        <input
          type="file"
          aria-label="Upload a file"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void onUpload?.(file);
          }}
        />
        {typeof value === "object" && value && "name" in value && (
          <p>Selected: {value.name}</p>
        )}
      </div>
    );
  if (question.type === "long_text")
    return (
      <textarea
        autoFocus
        className="flow-textarea"
        value={textValue}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            event.stopPropagation();
            onAdvance();
          }
        }}
        placeholder={question.settings.placeholder}
      />
    );
  return (
    <input
      autoFocus
      className="flow-input"
      type={
        question.type === "email"
          ? "email"
          : question.type === "number"
            ? "number"
            : "text"
      }
      value={textValue}
      min={question.settings.min}
      max={question.settings.max}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          event.stopPropagation();
          onAdvance();
        }
      }}
      placeholder={question.settings.placeholder}
    />
  );
}
