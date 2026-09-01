import { useEffect, useRef, useState } from "react";
import { uid } from "../lib/format.js";
import { Btn } from "../components/Btn.jsx";
import { Field } from "../components/Field.jsx";

const inputClass = "w-full rounded-none border border-ink bg-field px-3.5 py-3.5 text-[15px] text-ink outline-none font-body";
const textareaClass = `${inputClass} min-h-[70px] resize-y`;

export function SettingsView({
  goals,
  setGoals,
  channels,
  setChannels,
  settings,
  setSettings,
  firstGoalRef,
  activeGoals,
  loading,
  refresh,
  resetAll,
  onExport,
  onRestoreFile,
  restorePreview,
  restoreError,
  onConfirmRestore,
  onCancelRestore,
  readOnly = false,
}) {
  const [channelInput, setChannelInput] = useState("");
  const restoreErrorRef = useRef(null);
  const ro = readOnly;

  useEffect(() => {
    if (restoreError) restoreErrorRef.current?.focus();
  }, [restoreError]);

  const addChannel = () => {
    const channel = channelInput.trim();
    if (!channel) return;

    setChannels((cs) => (cs.includes(channel) ? cs : [...cs, channel]));
    setChannelInput("");
  };

  return (
    <div className="space-y-14">
      {ro && (
        <div
          className="border border-ink bg-card p-4 text-sm text-ink-soft font-body"
        >
          <strong className="text-ink">Demo edition.</strong> This is the programming screen the
          self-hosted app uses to define goals, channels, and edition times. Inputs are read-only here.
        </div>
      )}
      <fieldset
        disabled={ro}
        className="m-0 space-y-14 border-0 p-0 [min-inline-size:auto]"
      >
      <section>
        <div className="grid gap-6 md:grid-cols-[0.65fr_1fr] items-end">
          <h2
            className="font-display text-[clamp(44px,8vw,96px)] font-black uppercase leading-none tracking-[-0.06em] text-ink"
          >
            Goals
          </h2>
          <p className="max-w-xl text-lg leading-snug text-ink-soft font-body">
            Each goal gets a weekly time budget. The slate is programmed to fill it — and stop.
          </p>
        </div>
        <div className="mt-8 space-y-6">
          {goals.map((g, goalIndex) => (
            <div
              key={g.id}
              className="border border-ink bg-card p-6 shadow-[10px_10px_0_var(--color-ink)] md:p-8"
            >
              <div className="mb-6 flex items-center justify-between border-b border-ink pb-3">
                <span className="text-[10px] font-bold uppercase tracking-[0.28em] font-mono">
                  Program block
                </span>
                <span className="text-[10px] font-bold uppercase tracking-[0.28em] text-ink-soft font-mono">
                  {g.weeklyMinutes} min / week
                </span>
              </div>
              <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                <Field label="Goal name">
                  <input
                    id={goalIndex === 0 ? "first-goal" : undefined}
                    ref={goalIndex === 0 ? firstGoalRef : undefined}
                    className={inputClass}
                    value={g.name}
                    onChange={(e) =>
                      setGoals((gs) =>
                        gs.map((x) => (x.id === g.id ? { ...x, name: e.target.value } : x))
                      )
                    }
                  />
                </Field>
                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
                  <Field label="Ends">
                    <input
                      className={inputClass}
                      type="date"
                      value={g.endDate}
                      onChange={(e) =>
                        setGoals((gs) =>
                          gs.map((x) => (x.id === g.id ? { ...x, endDate: e.target.value } : x))
                        )
                      }
                    />
                  </Field>
                  <Field label="Weekly budget (min)">
                    <input
                      className={inputClass}
                      type="number"
                      min="10"
                      value={g.weeklyMinutes}
                      onChange={(e) =>
                        setGoals((gs) =>
                          gs.map((x) => (x.id === g.id ? { ...x, weeklyMinutes: +e.target.value } : x))
                        )
                      }
                    />
                  </Field>
                </div>
              </div>
              <div className="mt-4 grid gap-4 grid-cols-1 md:grid-cols-2">
                <Field label="What counts (used by the relevance scorer)">
                  <textarea
                    className={textareaClass}
                    value={g.description}
                    onChange={(e) =>
                      setGoals((gs) =>
                        gs.map((x) => (x.id === g.id ? { ...x, description: e.target.value } : x))
                      )
                    }
                  />
                </Field>
                <Field label="Search queries (comma-separated, max 2 used)">
                  <textarea
                    className={textareaClass}
                    value={g.keywords}
                    onChange={(e) =>
                      setGoals((gs) =>
                        gs.map((x) => (x.id === g.id ? { ...x, keywords: e.target.value } : x))
                      )
                    }
                  />
                </Field>
              </div>
              <div className="mt-3 text-right">
                <button
                  type="button"
                  onClick={() => setGoals((gs) => gs.filter((x) => x.id !== g.id))}
                  className="text-xs text-danger hover:opacity-70 font-body"
                >
                  Remove goal
                </button>
              </div>
            </div>
          ))}
          <Btn
            kind="ghost"
            onClick={() =>
              setGoals((gs) => [
                ...gs,
                {
                  id: uid(),
                  name: "New goal",
                  description: "",
                  keywords: "",
                  endDate: "",
                  weeklyMinutes: 60,
                },
              ])
            }
          >
            + Add goal
          </Btn>
        </div>
      </section>

      <section>
        <h2 className="font-display text-[24px] font-semibold text-ink">Channels</h2>
        <p className="mt-1 text-sm text-ink-soft font-body">
          Uploads from these channels join the candidate pool. They're ranked on relevance alone — no
          home-team advantage.
        </p>
        <div className="mt-4 flex gap-2 max-w-xl">
          <input
            className={inputClass}
            value={channelInput}
            onChange={(e) => setChannelInput(e.target.value)}
            placeholder="@handle or channel ID (UC...)"
            onKeyDown={(e) => {
              if (e.key === "Enter") addChannel();
            }}
          />
          <Btn kind="ghost" onClick={addChannel}>
            Add
          </Btn>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {channels.map((ch) => (
            <span
              key={ch}
              className="inline-flex items-center gap-2 rounded-full bg-mist px-3 py-1 text-xs text-ink font-mono"
            >
              {ch}
              <button
                type="button"
                onClick={() => setChannels((cs) => cs.filter((candidate) => candidate !== ch))}
                className="text-ink-soft hover:opacity-70"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-display text-[24px] font-semibold text-ink">The rules</h2>
        <div className="mt-4 grid gap-4 max-w-3xl grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Min length (min)">
            <input
              className={inputClass}
              type="number"
              min="0"
              value={settings.minLengthMin}
              onChange={(e) => setSettings((s) => ({ ...s, minLengthMin: +e.target.value }))}
            />
          </Field>
          <Field label="Slate cap (videos)">
            <input
              className={inputClass}
              type="number"
              min="3"
              max="30"
              value={settings.feedCap}
              onChange={(e) => setSettings((s) => ({ ...s, feedCap: +e.target.value }))}
            />
          </Field>
          <Field label="Morning edition">
            <input
              className={inputClass}
              type="time"
              value={settings.refreshTimes[0]}
              onChange={(e) =>
                setSettings((s) => ({ ...s, refreshTimes: [e.target.value, s.refreshTimes[1]] }))
              }
            />
          </Field>
          <Field label="Evening edition">
            <input
              className={inputClass}
              type="time"
              value={settings.refreshTimes[1]}
              onChange={(e) =>
                setSettings((s) => ({ ...s, refreshTimes: [s.refreshTimes[0], e.target.value] }))
              }
            />
          </Field>
          <Field label="Lookback (days)">
            <input
              className={inputClass}
              type="number"
              min="7"
              max="365"
              value={settings.lookbackDays}
              onChange={(e) => setSettings((s) => ({ ...s, lookbackDays: +e.target.value }))}
            />
          </Field>
        </div>
        <label
          className="mt-4 flex items-center gap-3 text-sm text-ink font-body"
        >
          <input
            type="checkbox"
            checked={settings.blockShorts}
            onChange={(e) => setSettings((s) => ({ ...s, blockShorts: e.target.checked }))}
            className="h-4 w-4 accent-pine"
          />
          Block Shorts (anything under 3 minutes)
        </label>
      </section>

      <section
        className="flex items-center justify-between rounded-lg bg-pine-deep p-5"
      >
        <div>
          <p className="font-display text-[18px] font-semibold text-white">
            Ready to air?
          </p>
          <p className="mt-1 text-xs text-[#c9d6d1] font-body">
            {activeGoals.length} active goal{activeGoals.length !== 1 ? "s" : ""} · {channels.length}{" "}
            channel{channels.length !== 1 ? "s" : ""} · editions at {settings.refreshTimes.join(" and ")}
          </p>
        </div>
        <Btn kind="accent" onClick={() => refresh(true)} disabled={loading}>
          {loading ? "Programming..." : "Build first slate"}
        </Btn>
      </section>

      {!ro && (
        <section aria-labelledby="local-data-heading" className="max-w-3xl">
          <h2 id="local-data-heading" className="font-display text-[24px] font-semibold text-ink">
            Your local data
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-ink-soft font-body">
            Export a portable copy of your goals and slate, or restore one after checking its contents. Credentials are never part of a Slate backup.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Btn onClick={onExport}>Export backup</Btn>
            <label
              htmlFor="restore-file"
              className="inline-flex cursor-pointer items-center border border-ink px-6 py-3 text-xs font-semibold uppercase tracking-wider text-ink font-body"
            >
              Restore backup
              <input
                id="restore-file"
                className="sr-only"
                type="file"
                accept="application/json,.json"
                onChange={onRestoreFile}
              />
            </label>
          </div>
          {restoreError && (
            <p
              ref={restoreErrorRef}
              className="mt-4 text-sm text-danger font-body"
              role="alert"
              tabIndex={-1}
            >
              Backup could not be restored: {restoreError}
            </p>
          )}
          {restorePreview && (
            <div className="mt-4 border border-ink bg-card p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-ink-soft font-mono">
                READY TO REPLACE
              </p>
              <p className="mt-2 text-sm text-ink font-body">
                This backup contains {restorePreview.goalCount} goal{restorePreview.goalCount === 1 ? "" : "s"}, {restorePreview.videoCount} video{restorePreview.videoCount === 1 ? "" : "s"}, and {restorePreview.historyCount} history entr{restorePreview.historyCount === 1 ? "y" : "ies"}.
              </p>
              <p className="mt-1 text-xs text-ink-soft font-body">
                Confirming replaces the current Slate data in this browser.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Btn onClick={onConfirmRestore}>Replace local data</Btn>
                <Btn kind="ghost" onClick={onCancelRestore}>Cancel</Btn>
              </div>
            </div>
          )}
        </section>
      )}

      {!ro && (
        <p className="text-right">
          <button
            type="button"
            onClick={resetAll}
            className="text-xs text-danger hover:opacity-70 font-body"
          >
            Reset all local data
          </button>
        </p>
      )}
      </fieldset>
    </div>
  );
}
