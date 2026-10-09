"use client";

import { useParams } from "next/navigation";
import { FormBuilder } from "@/features/builder/components/FormBuilder";

export default function FormBuilderPage() {
  const params = useParams<{ formId: string }>();
  return <FormBuilder formId={params.formId} />;
}
