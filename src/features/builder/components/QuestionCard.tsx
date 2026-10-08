import type { DragEvent, MouseEvent } from "react";
import { Icon } from "@/components/ui/Icon";
import { type Question, typeLabels } from "@/types/form";

type Props = { question: Question; index: number; selected: boolean; onSelect: () => void; onDelete: () => void; onDuplicate: () => void; onDragStart: () => void; onDrop: () => void };

export function QuestionCard({ question, index, selected, onSelect, onDelete, onDuplicate, onDragStart, onDrop }: Props) {
  const stopCardDrag = (event: DragEvent<HTMLButtonElement>) => event.preventDefault();
  const stopCardClick = (event: MouseEvent<HTMLButtonElement>) => event.stopPropagation();

  return <article className={`question-card ${selected ? "selected" : ""}`} draggable onDragStart={(event) => {
    if ((event.target as HTMLElement).closest("button")) {
      event.preventDefault();
      return;
    }
    onDragStart();
  }} onDragOver={(event) => event.preventDefault()} onDrop={onDrop} onClick={onSelect}>
    <button type="button" className="drag-handle" aria-label="Drag question" onDragStart={stopCardDrag} onClick={stopCardClick}><Icon name="drag" /></button>
    <span className="question-number">{index + 1}</span>
    <div className="question-card-copy"><strong>{question.title || "Untitled question"}</strong><span>{typeLabels[question.type]}</span></div>
    <div className="card-actions"><button type="button" aria-label={`Duplicate question ${index + 1}`} onDragStart={stopCardDrag} onClick={(event) => { event.stopPropagation(); onDuplicate(); }}><Icon name="copy" /></button><button type="button" className="delete-question" aria-label={`Delete question ${index + 1}`} onDragStart={stopCardDrag} onClick={(event) => { event.stopPropagation(); onDelete(); }}><Icon name="trash" /></button></div>
  </article>;
}
