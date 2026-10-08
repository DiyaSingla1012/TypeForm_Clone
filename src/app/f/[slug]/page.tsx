"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { Form } from "@/types/form";
import { api } from "@/lib/api";
import { RespondentFlow } from "@/features/respondent/components/RespondentFlow";

export default function PublicFormLink() {
  const { slug } = useParams<{ slug: string }>();
  const [form, setForm] = useState<Form | null | undefined>(undefined);

  useEffect(() => {
    api.getPublicForm(slug).then(setForm).catch(() => setForm(null));
  }, [slug]);

  if (form === undefined) return <main className="initial-loader">Loading form…</main>;
  if (!form) return <main className="public-link-page"><div className="public-link-card"><div className="brand-mark">t</div><h1>This form isn’t available</h1><p>It may be unpublished or the link may be incorrect.</p></div></main>;
  return <RespondentFlow form={form} />;
}
