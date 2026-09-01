import { C, BODY, DISPLAY, MONO } from "../theme.js";
import { Btn } from "./Btn.jsx";

function statusMessage(status) {
  if (status.code === "invalid-json") return "The saved local data is not valid JSON, so Slate kept it untouched.";
  if (status.code === "unsupported-version") return "The saved local data uses a newer Slate format, so Slate kept it untouched.";
  if (status.code === "invalid-schema") return "The saved local data does not match the supported Slate format, so Slate kept it untouched.";
  if (status.code === "read-failed") return "Slate could not read browser storage in this session.";
  if (status.code === "clear-failed") return "Slate could not clear browser storage, so reset did not change your current data.";
  return "Slate could not save the latest local change.";
}

export function StorageNotice({ status, onRetry, onExport }) {
  if (!status || status.status === "ready" || status.status === "empty" || status.status === "demo") return null;

  const writeFailed = status.code === "write-failed";
  return (
    <aside
      className="mb-10 p-5"
      role={writeFailed ? "alert" : "status"}
      aria-live={writeFailed ? "assertive" : "polite"}
      style={{ background: "#FBEFEA", border: `1px solid ${C.danger}`, color: C.danger }}
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.24em]" style={{ fontFamily: MONO }}>
        LOCAL DATA NEEDS ATTENTION
      </p>
      <h2 className="mt-2" style={{ color: C.ink, fontFamily: DISPLAY, fontSize: 24, fontWeight: 700 }}>
        Persistence is unavailable.
      </h2>
      <p className="mt-2 text-sm leading-relaxed" style={{ fontFamily: BODY }}>
        {statusMessage(status)} {writeFailed || status.code === "clear-failed" ? "Your work is still available in this tab." : "Slate cannot save automatically until you choose a recovery action."}
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <Btn onClick={onRetry}>Retry save</Btn>
        <Btn kind="ghost" onClick={onExport}>Export backup</Btn>
      </div>
    </aside>
  );
}
