import { useState } from "react";
import { C, DISPLAY, BODY, MONO, inputStyle } from "../theme.js";
import { uid } from "../lib/format.js";
import { Btn } from "../components/Btn.jsx";
import { Field } from "../components/Field.jsx";

export function SettingsView({
  goals,
  setGoals,
  channels,
  setChannels,
  settings,
  setSettings,
  activeGoals,
  loading,
  refresh,
  resetAll,
  readOnly = false,
}) {
  const [channelInput, setChannelInput] = useState("");
  const ro = readOnly;

  const addChannel = () => {
    if (channelInput.trim()) {
      setChannels((cs) => [...cs, channelInput.trim()]);
      setChannelInput("");
    }
  };

  return (
    <div className="space-y-14">
      {ro && (
        <div
          className="p-4 text-sm"
          style={{ background: C.card, border: `1px solid ${C.ink}`, fontFamily: BODY, color: C.inkSoft }}
        >
          <strong style={{ color: C.ink }}>Demo edition.</strong> This is the programming screen the
          self-hosted app uses to define goals, channels, and edition times. Inputs are read-only here.
        </div>
      )}
      <fieldset
        disabled={ro}
        className="space-y-14"
        style={{ border: 0, padding: 0, margin: 0, minInlineSize: "auto" }}
      >
      <section>
        <div className="grid gap-6 md:grid-cols-[0.65fr_1fr] items-end">
          <h2
            className="uppercase leading-none"
            style={{ fontFamily: DISPLAY, fontSize: "clamp(44px, 8vw, 96px)", fontWeight: 900, letterSpacing: "-0.06em", color: C.ink }}
          >
            Goals
          </h2>
          <p className="max-w-xl text-lg leading-snug" style={{ color: C.inkSoft, fontFamily: BODY }}>
            Each goal gets a weekly time budget. The slate is programmed to fill it — and stop.
          </p>
        </div>
        <div className="mt-8 space-y-6">
          {goals.map((g) => (
            <div
              key={g.id}
              className="p-6 md:p-8"
              style={{ background: C.card, border: `1px solid ${C.ink}`, boxShadow: `10px 10px 0 ${C.ink}` }}
            >
              <div className="mb-6 flex items-center justify-between border-b pb-3" style={{ borderColor: C.ink }}>
                <span className="text-[10px] font-bold uppercase tracking-[0.28em]" style={{ fontFamily: MONO }}>
                  Program block
                </span>
                <span className="text-[10px] font-bold uppercase tracking-[0.28em]" style={{ fontFamily: MONO, color: C.inkSoft }}>
                  {g.weeklyMinutes} min / week
                </span>
              </div>
              <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 1fr" }}>
                <Field label="Goal name">
                  <input
                    style={inputStyle}
                    value={g.name}
                    onChange={(e) =>
                      setGoals((gs) =>
                        gs.map((x) => (x.id === g.id ? { ...x, name: e.target.value } : x))
                      )
                    }
                  />
                </Field>
                <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 1fr" }}>
                  <Field label="Ends">
                    <input
                      style={inputStyle}
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
                      style={inputStyle}
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
              <div className="mt-4 grid gap-4" style={{ gridTemplateColumns: "1fr 1fr" }}>
                <Field label="What counts (used by the relevance scorer)">
                  <textarea
                    style={{ ...inputStyle, minHeight: 70, resize: "vertical" }}
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
                    style={{ ...inputStyle, minHeight: 70, resize: "vertical" }}
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
                  className="text-xs hover:opacity-70"
                  style={{ color: C.danger, fontFamily: BODY }}
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
        <h2 style={{ fontFamily: DISPLAY, fontSize: 24, fontWeight: 600, color: C.ink }}>Channels</h2>
        <p className="mt-1 text-sm" style={{ color: C.inkSoft, fontFamily: BODY }}>
          Uploads from these channels join the candidate pool. They're ranked on relevance alone — no
          home-team advantage.
        </p>
        <div className="mt-4 flex gap-2 max-w-xl">
          <input
            style={inputStyle}
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
          {channels.map((ch, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs"
              style={{ background: C.mist, color: C.ink, fontFamily: MONO }}
            >
              {ch}
              <button
                type="button"
                onClick={() => setChannels((cs) => cs.filter((_, j) => j !== i))}
                style={{ color: C.inkSoft }}
                className="hover:opacity-70"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      </section>

      <section>
        <h2 style={{ fontFamily: DISPLAY, fontSize: 24, fontWeight: 600, color: C.ink }}>The rules</h2>
        <div className="mt-4 grid gap-4 max-w-3xl" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
          <Field label="Min length (min)">
            <input
              style={inputStyle}
              type="number"
              min="0"
              value={settings.minLengthMin}
              onChange={(e) => setSettings((s) => ({ ...s, minLengthMin: +e.target.value }))}
            />
          </Field>
          <Field label="Slate cap (videos)">
            <input
              style={inputStyle}
              type="number"
              min="3"
              max="30"
              value={settings.feedCap}
              onChange={(e) => setSettings((s) => ({ ...s, feedCap: +e.target.value }))}
            />
          </Field>
          <Field label="Morning edition">
            <input
              style={inputStyle}
              type="time"
              value={settings.refreshTimes[0]}
              onChange={(e) =>
                setSettings((s) => ({ ...s, refreshTimes: [e.target.value, s.refreshTimes[1]] }))
              }
            />
          </Field>
          <Field label="Evening edition">
            <input
              style={inputStyle}
              type="time"
              value={settings.refreshTimes[1]}
              onChange={(e) =>
                setSettings((s) => ({ ...s, refreshTimes: [s.refreshTimes[0], e.target.value] }))
              }
            />
          </Field>
          <Field label="Lookback (days)">
            <input
              style={inputStyle}
              type="number"
              min="7"
              max="365"
              value={settings.lookbackDays}
              onChange={(e) => setSettings((s) => ({ ...s, lookbackDays: +e.target.value }))}
            />
          </Field>
        </div>
        <label
          className="mt-4 flex items-center gap-3 text-sm"
          style={{ fontFamily: BODY, color: C.ink }}
        >
          <input
            type="checkbox"
            checked={settings.blockShorts}
            onChange={(e) => setSettings((s) => ({ ...s, blockShorts: e.target.checked }))}
            style={{ accentColor: C.pine, width: 16, height: 16 }}
          />
          Block Shorts (anything under 3 minutes)
        </label>
      </section>

      <section
        className="rounded-lg p-5 flex items-center justify-between"
        style={{ background: C.pineDeep }}
      >
        <div>
          <p style={{ fontFamily: DISPLAY, fontSize: 18, fontWeight: 600, color: "#fff" }}>
            Ready to air?
          </p>
          <p className="text-xs mt-1" style={{ color: "#C9D6D1", fontFamily: BODY }}>
            {activeGoals.length} active goal{activeGoals.length !== 1 ? "s" : ""} · {channels.length}{" "}
            channel{channels.length !== 1 ? "s" : ""} · editions at {settings.refreshTimes.join(" and ")}
          </p>
        </div>
        <Btn kind="accent" onClick={() => refresh(true)} disabled={loading}>
          {loading ? "Programming..." : "Build first slate"}
        </Btn>
      </section>

      {!ro && (
        <p className="text-right">
          <button
            type="button"
            onClick={resetAll}
            className="text-xs hover:opacity-70"
            style={{ color: C.danger, fontFamily: BODY }}
          >
            Reset all local data
          </button>
        </p>
      )}
      </fieldset>
    </div>
  );
}
