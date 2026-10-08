"use client";

import { useCallback, useEffect, useState } from "react";
import type { Form } from "@/types/form";
import { api } from "@/lib/api";

export function useForms() {
  const [forms, setForms] = useState<Form[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    api.listForms().then(setForms).finally(() => setHydrated(true));
  }, []);

  const create = useCallback((title?: string) => {
    return api.createForm(title).then((form) => { setForms((current) => [form, ...current]); return form; });
  }, []);

  const update = useCallback((id: string, patch: Partial<Form>) => {
    return api.updateForm(id, patch).then((form) => setForms((current) => current.map((item) => item.id === id ? form : item)));
  }, []);

  const remove = useCallback((id: string) => api.deleteForm(id).then(() => setForms((current) => current.filter((form) => form.id !== id))), []);

  const duplicate = useCallback((id: string) => {
    return api.duplicateForm(id).then((copy) => { setForms((current) => [copy, ...current]); return copy; });
  }, []);

  const setPublication = useCallback((id: string, status: Form["status"]) => api.setPublication(id, status).then((form) => setForms((current) => current.map((item) => item.id === id ? form : item))), []);

  return { forms, hydrated, create, update, remove, duplicate, setPublication };
}
