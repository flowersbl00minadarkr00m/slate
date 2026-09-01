import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../src/App.jsx";
import { createBackup, saveState } from "../src/lib/storage.js";

const STORAGE_KEY = "slate.v1";
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const defaultState = {
  goals: [],
  channels: [],
  settings: {},
  videos: [],
  lastRefresh: null,
  history: [],
};

let root;

function buttonNamed(name) {
  return [...document.querySelectorAll("button")].find((button) => button.textContent.trim() === name);
}

function inputFor(labelText) {
  const label = [...document.querySelectorAll("label")].find((candidate) =>
    candidate.textContent.includes(labelText)
  );
  return label?.querySelector("input, textarea");
}

async function renderApp() {
  await act(async () => {
    root.render(<App />);
  });
}

async function chooseFile(input, contents) {
  const file = new File([JSON.stringify(contents)], "slate-backup.json", {
    type: "application/json",
  });
  Object.defineProperty(input, "files", { configurable: true, value: [file] });
  await act(async () => {
    input.dispatchEvent(new Event("change", { bubbles: true }));
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  });
}

function readBlobText(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

beforeEach(() => {
  window.history.pushState({}, "", "/");
  document.body.innerHTML = '<div id="test-root"></div>';
  root = createRoot(document.getElementById("test-root"));
  localStorage.clear();
});

afterEach(async () => {
  if (root) {
    await act(async () => root.unmount());
  }
  root = null;
  document.body.innerHTML = "";
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("first run and storage recovery", () => {
  it("starts a clean normal profile blank with a secondary isolated demo link", async () => {
    await renderApp();

    expect(document.body.textContent).toContain("Start with a blank slate.");
    expect(document.body.textContent).not.toContain("History and edge cases of AI governance");
    expect(document.querySelector('a[href="?demo=1"]')).not.toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();

    await act(async () => document.querySelector('a[href="#first-goal"]').click());
    expect(document.querySelector("#first-goal")).not.toBeNull();
    expect(document.querySelector("#first-goal").value).toBe("");
    expect(document.activeElement).toBe(document.querySelector("#first-goal"));
  });

  it("does not write fallback state after an invalid load", async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, goals: "corrupt" }));
    const setItem = vi.spyOn(Storage.prototype, "setItem");

    await renderApp();

    expect(document.body.textContent).toContain("LOCAL DATA NEEDS ATTENTION");
    expect(document.body.textContent).toContain("cannot save automatically");
    expect(setItem).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY))).toEqual({ version: 1, goals: "corrupt" });
  });

  it("attempts the first empty-state save, preserves focus, and recovers through retry and export", async () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementationOnce(() => {
      throw new Error("storage blocked");
    });

    await renderApp();
    await act(async () => buttonNamed("+ Add goal").click());
    const goalName = document.getElementById("first-goal");
    goalName.focus();
    const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;

    await act(async () => {
      nativeSetter.call(goalName, "My first goal");
      goalName.dispatchEvent(new Event("input", { bubbles: true }));
    });

    expect(document.activeElement).toBe(goalName);
    expect(setItem).toHaveBeenCalled();
    expect(document.body.textContent).toContain("Your work is still available in this tab");
    expect(document.body.textContent).toContain("Export backup");

    const exportedBlobs = [];
    const clickedAnchors = [];
    const originalCreateObjectURL = Object.getOwnPropertyDescriptor(URL, "createObjectURL");
    const originalRevokeObjectURL = Object.getOwnPropertyDescriptor(URL, "revokeObjectURL");
    const originalAnchorClick = Object.getOwnPropertyDescriptor(HTMLAnchorElement.prototype, "click");
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      writable: true,
      value: (blob) => {
        exportedBlobs.push(blob);
        return "blob:slate-backup";
      },
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      writable: true,
      value: () => {},
    });
    Object.defineProperty(HTMLAnchorElement.prototype, "click", {
      configurable: true,
      writable: true,
      value() {
        clickedAnchors.push({ href: this.href, download: this.download });
      },
    });

    try {
      await act(async () => buttonNamed("Export backup").click());
      expect(exportedBlobs).toHaveLength(1);
      expect(clickedAnchors).toEqual([
        { href: "blob:slate-backup", download: expect.stringMatching(/^slate-backup-.*\.json$/) },
      ]);
      const exported = JSON.parse(await readBlobText(exportedBlobs[0]));
      expect(exported).toEqual(expect.objectContaining({ format: "slate-backup", version: 1 }));
      expect(Object.keys(exported.state).sort()).toEqual(
        ["channels", "goals", "history", "lastRefresh", "settings", "version", "videos"].sort()
      );
      expect(exported.state.goals[0]).toEqual(expect.objectContaining({ name: "My first goal" }));
      expect(exported.state).not.toHaveProperty("apiKey");

      await act(async () => buttonNamed("Retry save").click());
      expect(document.body.textContent).not.toContain("LOCAL DATA NEEDS ATTENTION");
      expect(setItem).toHaveBeenCalledTimes(2);
      expect(JSON.parse(localStorage.getItem(STORAGE_KEY)).goals[0].name).toBe("My first goal");
    } finally {
      if (originalCreateObjectURL) Object.defineProperty(URL, "createObjectURL", originalCreateObjectURL);
      else delete URL.createObjectURL;
      if (originalRevokeObjectURL) Object.defineProperty(URL, "revokeObjectURL", originalRevokeObjectURL);
      else delete URL.revokeObjectURL;
      if (originalAnchorClick) Object.defineProperty(HTMLAnchorElement.prototype, "click", originalAnchorClick);
      else delete HTMLAnchorElement.prototype.click;
    }
  });

  it("restores only after a valid preview and explicit confirmation", async () => {
    await renderApp();
    const restoreInput = document.querySelector('input[type="file"]');
    const backup = createBackup(
      {
        ...defaultState,
        goals: [{ id: "restored-goal", name: "Restored goal", description: "From backup" }],
      },
      new Date("2026-08-31T12:00:00.000Z")
    );

    await chooseFile(restoreInput, { format: "slate-backup", version: 1, exportedAt: backup.exportedAt, state: { ...backup.state, goals: "bad" } });
    expect(document.body.textContent).toContain("Backup could not be restored");
    expect(document.body.textContent).not.toContain("Replace local data");

    await chooseFile(restoreInput, backup);
    expect(document.body.textContent).toContain("READY TO REPLACE");
    expect(document.body.textContent).not.toContain("Restored goal");

    window.confirm = vi.fn(() => false);
    await act(async () => buttonNamed("Replace local data").click());
    expect(document.body.textContent).not.toContain("Restored goal");

    window.confirm = vi.fn(() => true);
    await act(async () => buttonNamed("Replace local data").click());
    expect(inputFor("Goal name").value).toBe("Restored goal");
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)).goals[0].name).toBe("Restored goal");
  });

  it("keeps a valid restore in memory when its persistence fails", async () => {
    await renderApp();
    const restoreInput = document.querySelector('input[type="file"]');
    const backup = createBackup({
      ...defaultState,
      goals: [{ id: "restored-goal", name: "Restored in memory", description: "Still exportable" }],
    });
    await chooseFile(restoreInput, backup);

    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage blocked");
    });
    window.confirm = vi.fn(() => true);
    await act(async () => buttonNamed("Replace local data").click());

    expect(inputFor("Goal name").value).toBe("Restored in memory");
    expect(document.body.textContent).toContain("Your work is still available in this tab");
    expect(document.body.textContent).toContain("Export backup");
  });

  it("requires reset confirmation and returns to an unsaved blank state", async () => {
    saveState({
      ...defaultState,
      goals: [{ id: "existing", name: "Existing goal", description: "Keep until confirmed" }],
    });
    await renderApp();

    window.confirm = vi.fn(() => false);
    await act(async () => buttonNamed("Reset all local data").click());
    expect(inputFor("Goal name").value).toBe("Existing goal");
    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();

    window.confirm = vi.fn(() => true);
    await act(async () => buttonNamed("Reset all local data").click());
    expect(document.body.textContent).toContain("Start with a blank slate.");
    expect(inputFor("Goal name")).toBeUndefined();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});

describe("demo isolation", () => {
  it("renders demo data without calling storage", async () => {
    await act(async () => root.unmount());
    root = null;
    vi.resetModules();
    vi.doMock("../src/theme.js", async () => ({
      ...(await vi.importActual("../src/theme.js")),
      DEMO_MODE: true,
    }));
    const [{ default: DemoApp }, react, reactDom] = await Promise.all([
      import("../src/App.jsx"),
      import("react"),
      import("react-dom/client"),
    ]);
    const getItem = vi.spyOn(Storage.prototype, "getItem");
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const removeItem = vi.spyOn(Storage.prototype, "removeItem");
    root = reactDom.createRoot(document.getElementById("test-root"));

    await act(async () => root.render(react.createElement(DemoApp)));

    expect(document.body.textContent).toContain("DEMO EDITION");
    expect(document.body.textContent).toContain("From AI principles to controls that can be tested");
    expect(getItem).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
    expect(removeItem).not.toHaveBeenCalled();
  });
});
