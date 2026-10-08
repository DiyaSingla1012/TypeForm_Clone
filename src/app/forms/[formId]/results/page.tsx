"use client";

import { useParams } from "next/navigation";
import { ResultsView } from "@/features/results/components/ResultsView";

export default function ResultsPage() {
  const params = useParams<{ formId: string }>();
  return <ResultsView formId={params.formId} />;
}
