"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CATEGORIES, filterPairs } from "@bw/content";
import { MAX_PLAYERS, MIN_PLAYERS, maxMinorityCount, normalizeWord, type Difficulty } from "@bw/game-core";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { useLocalGame } from "./LocalGameContext";
import { newPlayerId, type RosterEntry } from "./storage";
import { MIN_CUSTOM_PAIRS, parseCustom } from "./pairs";

const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard"];

function OptionChip({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={selected}
      onClick={onClick}
      className={`min-h-[38px] rounded-lg border px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
        selected
          ? "border-teal bg-teal/10 text-teal"
          : "border-line bg-white text-ink hover:border-teal/50"
      }`}
    >
      {children}
    </button>
  );
}

export function SetupForm() {
  const router = useRouter();
  const { roster, prefs, start } = useLocalGame();
  const [names, setNames] = useState<RosterEntry[]>(() =>
    roster.length >= MIN_PLAYERS
      ? roster
      : [...roster, ...Array.from({ length: MIN_PLAYERS - roster.length }, () => ({ id: newPlayerId(), name: "" }))],
  );
  const [minorityCount, setMinorityCount] = useState(prefs.minorityCount);
  const [timersOn, setTimersOn] = useState(prefs.timersOn);
  const [categories, setCategories] = useState<string[]>(prefs.categories ?? []);
  const [difficulties, setDifficulties] = useState<Difficulty[]>(prefs.difficulties);
  const [useCustomOnly, setUseCustomOnly] = useState(prefs.useCustomOnly);
  const [customCsv, setCustomCsv] = useState(prefs.customCsv);
  const [formError, setFormError] = useState<string | null>(null);

  const filledCount = names.filter((n) => n.name.trim() !== "").length;
  const maxMinority = filledCount >= 3 ? maxMinorityCount(filledCount) : 1;

  const custom = useMemo(() => parseCustom(customCsv), [customCsv]);
  const catalogCount = useMemo(
    () =>
      filterPairs({
        categories: categories.length > 0 ? categories : undefined,
        difficulties,
      }).length,
    [categories, difficulties],
  );

  function updateName(id: string, name: string) {
    setNames((prev) => prev.map((n) => (n.id === id ? { ...n, name } : n)));
  }

  function addRow() {
    if (names.length >= MAX_PLAYERS) return;
    setNames((prev) => [...prev, { id: newPlayerId(), name: "" }]);
  }

  function removeRow(id: string) {
    setNames((prev) => (prev.length <= MIN_PLAYERS ? prev : prev.filter((n) => n.id !== id)));
  }

  function toggle<T>(list: T[], value: T): T[] {
    return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
  }

  function handleFile(file: File) {
    file.text().then(setCustomCsv);
  }

  function handleStart() {
    const finalRoster = names.filter((n) => n.name.trim() !== "").map((n) => ({ ...n, name: n.name.trim() }));

    if (finalRoster.length < MIN_PLAYERS || finalRoster.length > MAX_PLAYERS) {
      setFormError(`Between Words needs ${MIN_PLAYERS} to ${MAX_PLAYERS} players.`);
      return;
    }
    const normalized = finalRoster.map((r) => normalizeWord(r.name));
    if (new Set(normalized).size !== normalized.length) {
      setFormError("Two players have the same name. Give each player a distinct name.");
      return;
    }
    if (minorityCount < 1 || 2 * minorityCount >= finalRoster.length) {
      setFormError("The minority count must satisfy 1 ≤ K and 2K < number of players.");
      return;
    }
    if (useCustomOnly) {
      if (custom.pairs.length < MIN_CUSTOM_PAIRS) {
        setFormError(`Custom-only play needs at least ${MIN_CUSTOM_PAIRS} valid unique pairs.`);
        return;
      }
    } else if (catalogCount === 0) {
      setFormError("No word pairs match the selected categories and difficulties. Choose more.");
      return;
    }

    setFormError(null);
    start(finalRoster, {
      minorityCount,
      timersOn,
      categories: categories.length > 0 ? categories : null,
      difficulties,
      customCsv,
      useCustomOnly,
    });
    router.push("/local/play");
  }

  return (
    <div className="mx-auto max-w-xl py-8">
      <h1 className="font-display text-4xl font-bold tracking-tight">Pass &amp; Play</h1>
      <p className="mt-2 leading-relaxed text-muted">
        One device, passed around the table. Set up players and rules, then start.
      </p>

      <Card className="mt-6">
        <h2 className="font-display text-lg font-semibold">Players</h2>
        <p className="mt-1 text-sm text-muted">{MIN_PLAYERS} to {MAX_PLAYERS} players. Blank rows are ignored.</p>
        <div className="mt-4 grid gap-2">
          {names.map((n, i) => (
            <div key={n.id} className="flex gap-2">
              <label className="sr-only" htmlFor={`player-${n.id}`}>
                Player {i + 1} name
              </label>
              <input
                id={`player-${n.id}`}
                className="min-h-[44px] w-full rounded-lg border border-line bg-white px-3 py-2 outline-none focus:border-teal"
                placeholder={`Player ${i + 1}`}
                value={n.name}
                maxLength={40}
                onChange={(e) => updateName(n.id, e.target.value)}
              />
              <Button
                type="button"
                variant="secondary"
                aria-label={`Remove player ${i + 1}`}
                onClick={() => removeRow(n.id)}
                disabled={names.length <= MIN_PLAYERS}
              >
                ✕
              </Button>
            </div>
          ))}
        </div>
      <Button type="button" variant="secondary" className="mt-3" onClick={addRow} disabled={names.length >= MAX_PLAYERS}>
          + Add player
        </Button>
      </Card>

      <Card className="mt-4">
        <h2 className="font-display text-lg font-semibold">Rules</h2>
        <div className="mt-4">
          <label htmlFor="minority" className="block text-sm font-semibold">
            Minority players
          </label>
          <select
            id="minority"
            className="mt-1 min-h-[44px] rounded-lg border border-line bg-white px-3 py-2"
            value={Math.min(minorityCount, maxMinority)}
            onChange={(e) => setMinorityCount(Number(e.target.value))}
          >
            {Array.from({ length: maxMinority }, (_, i) => i + 1).map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </div>

        <label className="mt-4 flex min-h-[44px] items-center gap-2">
          <input type="checkbox" checked={timersOn} onChange={(e) => setTimersOn(e.target.checked)} />
          <span>Use timers (30s clues, 90s discussion, 30s voting)</span>
        </label>
        <p className="mt-1 text-sm text-muted">
          Off by default so people can pass the device comfortably. Local votes and word reveal
          always stay untimed.
        </p>

        <fieldset className="mt-4">
          <legend className="text-sm font-semibold">Categories (all if none chosen)</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <OptionChip key={c} selected={categories.includes(c)} onClick={() => setCategories((p) => toggle(p, c))}>
                {c}
              </OptionChip>
            ))}
          </div>
        </fieldset>

        <fieldset className="mt-4">
          <legend className="text-sm font-semibold">Difficulty</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {DIFFICULTIES.map((d) => (
              <OptionChip
                key={d}
                selected={difficulties.includes(d)}
                onClick={() => setDifficulties((p) => (p.length > 1 ? toggle(p, d) : p))}
              >
                {d}
              </OptionChip>
            ))}
          </div>
          {!useCustomOnly && (
            <p className="mt-2 text-sm text-muted">{catalogCount} matching pairs in the catalog.</p>
          )}
        </fieldset>
      </Card>

      <Card className="mt-4">
        <label className="flex min-h-[44px] items-center gap-2">
          <input
            type="checkbox"
            checked={useCustomOnly}
            onChange={(e) => setUseCustomOnly(e.target.checked)}
          />
          <span className="font-display text-lg font-semibold">Use a custom word list instead</span>
        </label>
        {useCustomOnly && (
          <div className="mt-3">
            <p className="text-sm text-muted">
              One pair per line: <code>wordA,wordB,category,difficulty</code>. Category and
              difficulty are optional.{" "}
              <a href="/example-custom-pairs.csv" className="font-semibold text-teal underline">
                Download an example
              </a>
              . Whoever writes this list already knows every possible pair — it&apos;s not a
              secret from them.
            </p>
            <textarea
              className="mt-2 h-32 w-full rounded-lg border border-line bg-white p-3 font-mono text-sm outline-none focus:border-teal"
              placeholder={"wordA,wordB,category,difficulty\ncappuccino,latte,drinks,medium"}
              value={customCsv}
              maxLength={100_000}
              onChange={(e) => setCustomCsv(e.target.value)}
            />
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <label className="min-h-[44px] cursor-pointer rounded-lg border border-line bg-white px-3 py-2 text-sm font-semibold">
                Import CSV file
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="sr-only"
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                />
              </label>
              <Button type="button" variant="secondary" onClick={() => setCustomCsv("")}>
                Clear list
              </Button>
              <span className="text-sm text-muted">
                {custom.pairs.length} valid pair{custom.pairs.length === 1 ? "" : "s"}
                {custom.pairs.length < MIN_CUSTOM_PAIRS ? ` (need ${MIN_CUSTOM_PAIRS})` : ""}
              </span>
            </div>
            {custom.issues.length > 0 && (
              <ul className="mt-2 max-h-32 overflow-auto text-sm text-danger">
                {custom.issues.map((issue, i) => (
                  <li key={i}>
                    Line {issue.line}: {issue.code.replaceAll("_", " ").toLowerCase()}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Card>

      {formError && (
        <p role="alert" className="mt-4 rounded-lg bg-danger-bg px-4 py-3 text-sm text-danger">
          {formError}
        </p>
      )}

      <Button type="button" className="mt-6 w-full" onClick={handleStart}>
        Start game
      </Button>
      <p className="mt-3 text-center text-xs text-muted">
        Refreshing the page during a game ends it without a winner — words are never saved
        outside this session.
      </p>
    </div>
  );
}
