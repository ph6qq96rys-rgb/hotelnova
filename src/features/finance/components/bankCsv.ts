/** Bank statement CSV import: parse any bank's export, then map its columns to date, reference and amount. */

export type BankCsvLine = { date: string; reference: string; amount: number };
export type DateFormat = "YYYY-MM-DD" | "DD/MM/YYYY" | "MM/DD/YYYY";
export type BankCsvMapping = {
  hasHeader: boolean;
  date: number;
  dateFormat: DateFormat;
  reference: number[];
  /** "single": one signed amount column; "split": money out and money in in separate columns. */
  amountMode: "single" | "split";
  amount: number;
  moneyOut: number;
  moneyIn: number;
};

/** Splits CSV text (comma, semicolon or tab separated; quoted values allowed) into rows of cells. */
export function parseCsvRows(text: string): string[][] {
  const clean = text.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const firstLine = clean.split("\n", 1)[0] ?? "";
  const separator = [",", ";", "\t"].map(s => ({ s, n: firstLine.split(s).length })).sort((a, b) => b.n - a.n)[0].s;
  const rows: string[][] = []; let row: string[] = []; let value = ""; let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (c === '"') { if (quoted && clean[i + 1] === '"') { value += '"'; i++; } else quoted = !quoted; }
    else if (c === separator && !quoted) { row.push(value.trim()); value = ""; }
    else if (c === "\n" && !quoted) { row.push(value.trim()); if (row.some(Boolean)) rows.push(row); row = []; value = ""; }
    else value += c;
  }
  if (quoted) throw new Error("The CSV contains an unclosed quote.");
  row.push(value.trim()); if (row.some(Boolean)) rows.push(row);
  return rows;
}

/** Reads amounts as banks write them: 1,234.50 · 1 234.50 · (1,234.50) · -1234.5 · 1234.50 CR / DR. Empty is zero. */
export function parseAmount(raw: string): number {
  let text = (raw ?? "").trim();
  if (!text) return 0;
  let sign = 1;
  if (/^\(.*\)$/.test(text)) { sign = -1; text = text.slice(1, -1); }
  if (/\bDR$/i.test(text)) { sign = -sign; text = text.replace(/\bDR$/i, ""); }
  text = text.replace(/\bCR$/i, "").replace(/[^\d.,-]/g, "");
  if (text.includes(",") && text.includes(".")) text = text.replace(/,/g, "");
  else if (/^-?\d{1,3}(,\d{3})+$/.test(text)) text = text.replace(/,/g, "");
  else text = text.replace(",", ".");
  const value = Number(text);
  if (!Number.isFinite(value)) throw new Error(`"${raw}" is not an amount.`);
  return Math.round(sign * value * 100) / 100;
}

/** Turns a date in the chosen format into YYYY-MM-DD. */
export function parseDate(raw: string, format: DateFormat): string {
  const text = (raw ?? "").trim().split(/[ T]/)[0];
  const parts = text.split(/[-/.]/);
  if (parts.length !== 3) throw new Error(`"${raw}" is not a date.`);
  const [y, m, d] = format === "YYYY-MM-DD" ? parts : format === "DD/MM/YYYY" ? [parts[2], parts[1], parts[0]] : [parts[2], parts[0], parts[1]];
  const year = y.length === 2 ? "20" + y : y;
  const iso = `${year.padStart(4, "0")}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  const check = new Date(iso + "T00:00:00Z");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || Number.isNaN(check.getTime()) || check.toISOString().slice(0, 10) !== iso) throw new Error(`"${raw}" is not a valid ${format} date.`);
  return iso;
}

/** Guesses the mapping from the header row (Date, Description/Narration/Reference, Amount or Debit/Credit, Withdrawal/Deposit). */
export function guessMapping(rows: string[][]): BankCsvMapping {
  const header = (rows[0] ?? []).map(h => h.toLowerCase());
  const find = (...names: string[]) => header.findIndex(h => names.some(n => h.includes(n)));
  const hasHeader = header.some(h => /[a-z]/.test(h) && !/^\d/.test(h));
  const date = Math.max(0, find("date"));
  const reference = [find("description", "narration", "details", "particular", "reference", "remark")].filter(i => i >= 0);
  const moneyOut = find("debit", "withdrawal", "money out", "paid out");
  const moneyIn = find("credit", "deposit", "money in", "paid in");
  const amount = find("amount");
  const sample = rows[hasHeader ? 1 : 0]?.[date] ?? "";
  const dateFormat: DateFormat = /^\d{4}/.test(sample) ? "YYYY-MM-DD" : "DD/MM/YYYY";
  return {
    hasHeader, date, dateFormat, reference: reference.length ? reference : [Math.min(1, header.length - 1)],
    amountMode: amount < 0 && moneyOut >= 0 && moneyIn >= 0 ? "split" : "single",
    amount: amount >= 0 ? amount : Math.min(2, Math.max(0, header.length - 1)), moneyOut: Math.max(0, moneyOut), moneyIn: Math.max(0, moneyIn),
  };
}

/** Applies the mapping; lines with no amount (e.g. balance-only rows) are skipped. Errors name the CSV line. */
export function mapBankRows(rows: string[][], m: BankCsvMapping): BankCsvLine[] {
  const out: BankCsvLine[] = [];
  rows.slice(m.hasHeader ? 1 : 0).forEach((r, i) => {
    const line = i + (m.hasHeader ? 2 : 1);
    try {
      const amount = m.amountMode === "single" ? parseAmount(r[m.amount] ?? "") : parseAmount(r[m.moneyIn] ?? "") - Math.abs(parseAmount(r[m.moneyOut] ?? ""));
      if (amount === 0) return;
      const reference = m.reference.map(c => r[c] ?? "").filter(Boolean).join(" · ").slice(0, 200);
      out.push({ date: parseDate(r[m.date] ?? "", m.dateFormat), reference: reference || `Line ${line}`, amount: Math.round(amount * 100) / 100 });
    } catch (e) {
      throw new Error(`CSV line ${line}: ${e instanceof Error ? e.message : String(e)}`);
    }
  });
  return out;
}

/** The original strict format (Date,Reference,Amount with ISO dates), kept for existing callers. */
export function parseBankCsv(text: string): BankCsvLine[] {
  const rows = parseCsvRows(text);
  const hasHeader = rows[0]?.[0]?.toLowerCase() === "date";
  return mapBankRows(rows, { hasHeader, date: 0, dateFormat: "YYYY-MM-DD", reference: [1], amountMode: "single", amount: 2, moneyOut: 0, moneyIn: 0 });
}
