"use client";

import { useEffect, useState } from "react";
import { type Form } from "@/types/form";
import { api } from "@/lib/api";

export function useFormDraft(formId: string) {
  const [form, setForm] = useState<Form | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    api.getForm(formId).then(setForm).catch(() => setForm(null)).finally(() => setHydrated(true));
  }, [formId]);

  return { form, setForm, hydrated };
}
