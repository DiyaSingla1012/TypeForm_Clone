export const QUESTION_TYPES = [
  "short_text",
  "long_text",
  "multiple_choice",
  "dropdown",
  "email",
  "number",
  "yes_no",
  "rating",
  "file_upload",
] as const;

export type QuestionType = (typeof QUESTION_TYPES)[number];

export type Question = {
  id: string;
  type: QuestionType;
  title: string;
  description: string;
  required: boolean;
  options?: string[];
  settings: QuestionSettings;
};

export type QuestionSettings = {
  placeholder?: string;
  min?: number;
  max?: number;
  ratingSteps?: 5 | 7 | 10;
  ratingLowLabel?: string;
  ratingHighLabel?: string;
  allowOther?: boolean;
  /** Maps a choice label to the question ID to show next. */
  logic?: Record<string, string>;
};

export type FormAppearance = {
  background?: string;
  accent?: string;
  font?: "sans" | "serif" | "mono";
};

export type Form = {
  id: string;
  title: string;
  questions: Question[];
  status: "draft" | "published";
  slug: string;
  questionCount: number;
  responseCount: number;
  createdAt: string;
  updatedAt: string;
  theme: FormTheme;
  appearance: FormAppearance;
  thankYou: ThankYouScreen;
};

export type FormTheme = "blue" | "peach" | "sage" | "ink";

export type ThankYouScreen = {
  title: string;
  message: string;
};

export const formThemes: Record<
  FormTheme,
  { label: string; background: string; accent: string }
> = {
  blue: { label: "Periwinkle", background: "#e7edff", accent: "#355bea" },
  peach: { label: "Apricot", background: "#fff0e5", accent: "#bd5929" },
  sage: { label: "Sage", background: "#e5f0e7", accent: "#2e7953" },
  ink: { label: "Midnight", background: "#242429", accent: "#d8ff00" },
};

export type FileAnswer = { id: string; name: string; url: string };
export type Answer = string | number | boolean | string[] | FileAnswer | null;

export type Response = {
  id: string;
  formId: string;
  answers: Record<string, Answer>;
  submittedAt: string;
};

export const typeLabels: Record<QuestionType, string> = {
  short_text: "Short text",
  long_text: "Long text",
  multiple_choice: "Multiple choice",
  dropdown: "Dropdown",
  email: "Email",
  number: "Number",
  yes_no: "Yes / No",
  rating: "Rating",
  file_upload: "File upload",
};

export const choiceTypes: QuestionType[] = ["multiple_choice", "dropdown"];

export function createQuestion(type: QuestionType): Question {
  const needsOptions = choiceTypes.includes(type);
  return {
    id: crypto.randomUUID(),
    type,
    title: `Your ${typeLabels[type].toLowerCase()} question`,
    description: "",
    required: false,
    settings:
      type === "rating"
        ? {
            ratingSteps: 5,
            ratingLowLabel: "Not likely",
            ratingHighLabel: "Very likely",
          }
        : type === "number"
          ? { placeholder: "Enter a number" }
          : type === "email"
            ? { placeholder: "name@example.com" }
            : { placeholder: "Type your answer here..." },
    ...(needsOptions ? { options: ["Option 1", "Option 2"] } : {}),
  };
}

export function createForm(title = "Untitled form"): Form {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  return {
    id,
    title,
    slug: `form-${id.slice(0, 8)}`,
    status: "draft",
    questionCount: 1,
    responseCount: 0,
    createdAt: now,
    updatedAt: now,
    theme: "blue",
    appearance: {},
    thankYou: {
      title: "Thank you!",
      message: "Your response has been recorded.",
    },
    questions: [
      {
        id: crypto.randomUUID(),
        type: "short_text",
        title: "What should we call you?",
        description: "We'd love to get to know you.",
        required: true,
        settings: { placeholder: "Type your answer here..." },
      },
    ],
  };
}
