import { Icon } from "@/components/ui/Icon";

export function EmptyBuilder({ onAdd }: { onAdd: () => void }) {
  return <div className="empty-builder"><div className="empty-icon"><Icon name="plus" /></div><h1>Start with a question</h1><p>Build a focused, conversational form one question at a time.</p><button className="publish-button" onClick={onAdd}><Icon name="plus" /> Add your first question</button></div>;
}
