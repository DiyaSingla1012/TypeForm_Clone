import type { Answer, Question } from "@/types/form";

export function validateAnswer(question: Question, answer: Answer | undefined): string | null {
  const blank = answer === undefined || answer === null || answer === "";
  if (question.required && blank) return "Please answer this question to continue.";
  if (blank) return null;
  if (question.type === "email" && (typeof answer !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(answer))) return "Enter a valid email address.";
  if (question.type === "number") {
    const value = Number(answer);
    if (!Number.isFinite(value)) return "Enter a valid number.";
    if (question.settings.min !== undefined && value < question.settings.min) return `Enter a number of at least ${question.settings.min}.`;
    if (question.settings.max !== undefined && value > question.settings.max) return `Enter a number no greater than ${question.settings.max}.`;
  }
  return null;
}
