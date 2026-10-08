import { Icon } from "@/components/ui/Icon";
import { QUESTION_TYPES, type QuestionType, typeLabels } from "@/types/form";

export function QuestionTypeMenu({
  onChoose,
}: {
  onChoose: (type: QuestionType) => void;
}) {
  return (
    <div className="type-menu">
      <div className="menu-heading">Add a question</div>
      <div className="type-grid">
        {QUESTION_TYPES.map((type) => (
          <button
            key={type}
            className="type-choice"
            onClick={() => onChoose(type)}
          >
            <span className="type-icon">
              <Icon name="plus" />
            </span>
            {typeLabels[type]}
          </button>
        ))}
      </div>
      <div className="menu-heading future-question-heading">Coming soon</div>
      <div className="type-grid">
        <button
          className="type-choice placeholder-choice"
          type="button"
          disabled
        >
          <span className="type-icon">
            <Icon name="plus" />
          </span>
          Payment <small>Coming soon</small>
        </button>
      </div>
    </div>
  );
}
