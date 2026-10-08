import { Icon } from "@/components/ui/Icon";
import {
  choiceTypes,
  QUESTION_TYPES,
  type Question,
  type QuestionSettings,
  type QuestionType,
  typeLabels,
} from "@/types/form";

export function QuestionEditor({
  question,
  update,
  questions = [],
}: {
  question: Question;
  update: (patch: Partial<Question>) => void;
  questions?: Question[];
}) {
  const options = question.options ?? [];
  const optionBased = choiceTypes.includes(question.type);
  return (
    <section className="editor-panel">
      <label className="field-label">Question type</label>
      <select
        className="question-type-select"
        value={question.type}
        onChange={(event) => {
          const type = event.target.value as QuestionType;
          update({
            type,
            options: choiceTypes.includes(type)
              ? question.options?.length
                ? question.options
                : ["Option 1", "Option 2"]
              : undefined,
          });
        }}
      >
        {QUESTION_TYPES.map((type) => (
          <option key={type} value={type}>
            {typeLabels[type]}
          </option>
        ))}
      </select>
      <label className="field-label">Question</label>
      <textarea
        className="question-title"
        rows={2}
        value={question.title}
        onChange={(event) => update({ title: event.target.value })}
        placeholder="Type your question"
      />
      <label className="field-label">
        Description <span>optional</span>
      </label>
      <input
        className="text-input"
        value={question.description}
        onChange={(event) => update({ description: event.target.value })}
        placeholder="Add help text"
      />
      {optionBased && (
        <div className="options-editor">
          <label className="field-label">Choices</label>
          {options.map((option, index) => (
            <div className="option-row" key={`${question.id}-${index}`}>
              <span>{String.fromCharCode(65 + index)}</span>
              <input
                value={option}
                onChange={(event) =>
                  update({
                    options: options.map((value, i) =>
                      i === index ? event.target.value : value,
                    ),
                  })
                }
              />
              <button
                className="option-move"
                disabled={index === 0}
                aria-label="Move choice up"
                onClick={() =>
                  update({ options: move(options, index, index - 1) })
                }
              >
                ↑
              </button>
              <button
                className="option-move"
                disabled={index === options.length - 1}
                aria-label="Move choice down"
                onClick={() =>
                  update({ options: move(options, index, index + 1) })
                }
              >
                ↓
              </button>
              <button
                aria-label="Remove choice"
                disabled={options.length <= 2}
                onClick={() =>
                  update({ options: options.filter((_, i) => i !== index) })
                }
              >
                <Icon name="trash" />
              </button>
            </div>
          ))}
          <button
            className="subtle-button"
            onClick={() =>
              update({ options: [...options, `Option ${options.length + 1}`] })
            }
          >
            <Icon name="plus" /> Add choice
          </button>
        </div>
      )}
      <QuestionSpecificSettings question={question} update={update} />
      {(optionBased || question.type === "yes_no") && (
        <ChoiceBranching
          question={question}
          questions={questions}
          update={update}
        />
      )}
      <div className="setting-row">
        <div>
          <strong>Required</strong>
          <span>Respondents must answer</span>
        </div>
        <button
          className={`switch ${question.required ? "on" : ""}`}
          aria-pressed={question.required}
          onClick={() => update({ required: !question.required })}
        >
          <i />
        </button>
      </div>
    </section>
  );
}

function ChoiceBranching({
  question,
  questions,
  update,
}: {
  question: Question;
  questions: Question[];
  update: (patch: Partial<Question>) => void;
}) {
  const sourceIndex = questions.findIndex((item) => item.id === question.id);
  const destinations = questions.slice(sourceIndex + 1);
  if (destinations.length === 0) return null;
  const choices =
    question.type === "yes_no"
      ? ["Yes", "No"]
      : [
          ...(question.options ?? []),
          ...(question.settings.allowOther ? ["Other"] : []),
        ];
  const setDestination = (choice: string, targetQuestionId: string) => {
    const logic = { ...(question.settings.logic ?? {}) };
    if (targetQuestionId) logic[choice] = targetQuestionId;
    else delete logic[choice];
    update({
      settings: {
        ...question.settings,
        logic: Object.keys(logic).length ? logic : undefined,
      },
    });
  };
  return (
    <div className="question-settings branch-settings">
      <label className="field-label">
        Logic jumps <span>optional</span>
      </label>
      <p className="design-note">Choose where each answer goes next.</p>
      {choices.map((choice) => (
        <label className="branch-row" key={choice}>
          <span>{choice || "Untitled option"}</span>
          <select
            value={question.settings.logic?.[choice] ?? ""}
            onChange={(event) => setDestination(choice, event.target.value)}
          >
            <option value="">Continue in order</option>
            {destinations.map((destination, index) => (
              <option key={destination.id} value={destination.id}>
                Jump to Q{sourceIndex + index + 2}:{" "}
                {destination.title || "Untitled question"}
              </option>
            ))}
          </select>
        </label>
      ))}
    </div>
  );
}

function move(values: string[], from: number, to: number) {
  const next = [...values];
  const [value] = next.splice(from, 1);
  next.splice(to, 0, value);
  return next;
}

function QuestionSpecificSettings({
  question,
  update,
}: {
  question: Question;
  update: (patch: Partial<Question>) => void;
}) {
  const setSettings = (patch: Partial<QuestionSettings>) =>
    update({ settings: { ...question.settings, ...patch } });
  if (question.type === "yes_no")
    return (
      <div className="inline-note">
        Respondents choose between <strong>Yes</strong> and <strong>No</strong>.
      </div>
    );
  if (question.type === "rating") {
    const steps = question.settings.ratingSteps ?? 5;
    return (
      <div className="question-settings">
        <label className="field-label">Rating scale</label>
        <div className="segmented">
          {([5, 7, 10] as const).map((value) => (
            <button
              className={steps === value ? "active" : ""}
              key={value}
              onClick={() => setSettings({ ratingSteps: value })}
            >
              {value}
            </button>
          ))}
        </div>
        <div className="two-fields">
          <label>
            <span>Low label</span>
            <input
              value={question.settings.ratingLowLabel ?? ""}
              onChange={(event) =>
                setSettings({ ratingLowLabel: event.target.value })
              }
              placeholder="Not likely"
            />
          </label>
          <label>
            <span>High label</span>
            <input
              value={question.settings.ratingHighLabel ?? ""}
              onChange={(event) =>
                setSettings({ ratingHighLabel: event.target.value })
              }
              placeholder="Very likely"
            />
          </label>
        </div>
      </div>
    );
  }
  if (question.type === "number")
    return (
      <div className="question-settings">
        <label className="field-label">
          Number limits <span>optional</span>
        </label>
        <div className="two-fields">
          <label>
            <span>Minimum</span>
            <input
              type="number"
              value={question.settings.min ?? ""}
              onChange={(event) =>
                setSettings({
                  min:
                    event.target.value === ""
                      ? undefined
                      : Number(event.target.value),
                })
              }
              placeholder="No minimum"
            />
          </label>
          <label>
            <span>Maximum</span>
            <input
              type="number"
              value={question.settings.max ?? ""}
              onChange={(event) =>
                setSettings({
                  max:
                    event.target.value === ""
                      ? undefined
                      : Number(event.target.value),
                })
              }
              placeholder="No maximum"
            />
          </label>
        </div>
      </div>
    );
  if (question.type === "file_upload")
    return (
      <div className="inline-note">
        Respondents can upload one file up to <strong>10 MB</strong>. The file
        is stored on this server and linked to the response.
      </div>
    );
  if (choiceTypes.includes(question.type))
    return (
      <div className="question-settings">
        <div className="setting-row compact">
          <div>
            <strong>Allow “Other”</strong>
            <span>Let people write their own answer</span>
          </div>
          <button
            className={`switch ${question.settings.allowOther ? "on" : ""}`}
            aria-pressed={question.settings.allowOther}
            onClick={() =>
              setSettings({ allowOther: !question.settings.allowOther })
            }
          >
            <i />
          </button>
        </div>
      </div>
    );
  return (
    <div className="question-settings">
      <label className="field-label">
        Placeholder <span>optional</span>
      </label>
      <input
        className="text-input compact-input"
        value={question.settings.placeholder ?? ""}
        onChange={(event) => setSettings({ placeholder: event.target.value })}
        placeholder="Type your answer here..."
      />
    </div>
  );
}
