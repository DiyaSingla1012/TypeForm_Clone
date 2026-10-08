import { formThemes, type Form, type FormTheme } from "@/types/form";

export function FormDesignPanel({
  form,
  update,
}: {
  form: Form;
  update: (patch: Partial<Form>) => void;
}) {
  const setAppearance = (patch: Form["appearance"]) =>
    update({ appearance: { ...form.appearance, ...patch } });
  return (
    <div className="design-panel">
      <span className="section-kicker">THEME</span>
      <div className="theme-grid">
        {(Object.keys(formThemes) as FormTheme[]).map((theme) => (
          <button
            key={theme}
            className={`theme-choice ${form.theme === theme ? "active" : ""}`}
            onClick={() => update({ theme })}
          >
            <i style={{ background: formThemes[theme].background }}>
              <b style={{ background: formThemes[theme].accent }} />
            </i>
            <span>{formThemes[theme].label}</span>
          </button>
        ))}
      </div>
      <span className="section-kicker">CUSTOM APPEARANCE</span>
      <label className="design-label">
        Background
        <input
          type="color"
          value={
            form.appearance.background ?? formThemes[form.theme].background
          }
          onChange={(event) =>
            setAppearance({ background: event.target.value })
          }
        />
      </label>
      <label className="design-label">
        Accent
        <input
          type="color"
          value={form.appearance.accent ?? formThemes[form.theme].accent}
          onChange={(event) => setAppearance({ accent: event.target.value })}
        />
      </label>
      <label className="design-label">
        Font
        <select
          value={form.appearance.font ?? "sans"}
          onChange={(event) =>
            setAppearance({
              font: event.target.value as "sans" | "serif" | "mono",
            })
          }
        >
          <option value="sans">Modern sans</option>
          <option value="serif">Editorial serif</option>
          <option value="mono">Monospace</option>
        </select>
      </label>
      <span className="section-kicker thanks-kicker">THANK-YOU SCREEN</span>
      <label className="design-label">
        Headline
        <input
          value={form.thankYou.title}
          onChange={(event) =>
            update({
              thankYou: { ...form.thankYou, title: event.target.value },
            })
          }
        />
      </label>
      <label className="design-label">
        Message
        <textarea
          rows={3}
          value={form.thankYou.message}
          onChange={(event) =>
            update({
              thankYou: { ...form.thankYou, message: event.target.value },
            })
          }
        />
      </label>
      <p className="design-note">Shown after a completed response.</p>
    </div>
  );
}
