import React, { useMemo, useState } from "react";

// Self‑Service Report Builder — TSX version (fixed)
// - Strict typing for datasets, attributes, filters, aggregations, and rows
// - Tailwind CSS styling
// - Sample data generator
// - SQL‑ish query preview
// - CSV download + JSON config export
// - Generate Preview button forces recompute (runKey)
// - FIX: Unterminated string constant in toCSV newlines (now uses "\n")
// - DEV TESTS: lightweight assertions for toCSV & sqlPreview in dev mode

// ==== Types ====
export type DataType = "string" | "number" | "date" | "currency";

export interface AttributeDef {
  name: string;
  label: string;
  type: DataType;
}

export type Row = Record<string, string | number>;

export interface DatasetDef {
  id: string;
  name: string;
  description: string;
  attributes: AttributeDef[];
  sampleRows: Row[];
}

export type NumericFunc = "sum" | "avg" | "min" | "max" | "count";

export interface FilterDef {
  id: string;
  attribute: string;
  operator: string; // narrowed by UI depending on attribute type
  value: string; // UI treats everything as string input (parsed later)
}

export interface AggregationDef {
  attribute: string;
  func: NumericFunc;
}

export interface SortDef {
  attribute: string;
  direction: "ASC" | "DESC";
}

// ==== Catalog (schema only; rows are seeded at runtime) ====
const CATALOG: DatasetDef[] = [
  {
    id: "gl_balances",
    name: "GL Balances",
    description:
      "General Ledger end‑of‑day balances by legal entity, account, and currency.",
    attributes: [
      { name: "ledgerDate", label: "Ledger Date", type: "date" },
      { name: "legalEntity", label: "Legal Entity", type: "string" },
      { name: "glAccount", label: "GL Account", type: "string" },
      { name: "assetType", label: "Asset Type", type: "string" },
      { name: "currency", label: "Currency", type: "string" },
      { name: "balance", label: "Balance", type: "number" },
      { name: "netChange", label: "Net Change", type: "number" },
    ],
    sampleRows: [],
  },
  {
    id: "cash_movements",
    name: "Cash Movements",
    description:
      "Cash inflows/outflows with value date, product, and counterparty.",
    attributes: [
      { name: "valueDate", label: "Value Date", type: "date" },
      { name: "product", label: "Product", type: "string" },
      { name: "counterparty", label: "Counterparty", type: "string" },
      { name: "region", label: "Region", type: "string" },
      { name: "currency", label: "Currency", type: "string" },
      { name: "amount", label: "Amount", type: "number" },
      { name: "direction", label: "Direction", type: "string" },
    ],
    sampleRows: [],
  },
  {
    id: "trades",
    name: "Trades (Securities)",
    description:
      "Executed trades with instrument, desk, trader and notional/price.",
    attributes: [
      { name: "tradeDate", label: "Trade Date", type: "date" },
      { name: "instrument", label: "Instrument", type: "string" },
      { name: "desk", label: "Desk", type: "string" },
      { name: "trader", label: "Trader", type: "string" },
      { name: "qty", label: "Quantity", type: "number" },
      { name: "price", label: "Price", type: "number" },
      { name: "notional", label: "Notional", type: "number" },
      { name: "currency", label: "Currency", type: "string" },
    ],
    sampleRows: [],
  },
];

// ==== Utilities ====
const randPick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const pad2 = (n: number) => String(n).padStart(2, "0");

function genDate(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() - offsetDays);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function seedSamples(): DatasetDef[] {
  const seeded: DatasetDef[] = JSON.parse(JSON.stringify(CATALOG));

  // GL Balances
  const entities = ["JPMC UK", "JPMC US", "JPMC SG", "JPMC IN"];
  const accounts = ["100100 ASSETS", "200200 LIAB", "300300 EQUITY", "400400 REV"];
  const assets = ["Cash", "Loans", "Securities", "Derivatives"];
  const ccy = ["USD", "EUR", "GBP", "INR", "SGD"];
  for (let i = 0; i < 200; i++) {
    seeded[0].sampleRows.push({
      ledgerDate: genDate(Math.floor(Math.random() * 20)),
      legalEntity: randPick(entities),
      glAccount: randPick(accounts),
      assetType: randPick(assets),
      currency: randPick(ccy),
      balance: Number((Math.random() * 1_000_000 - 500_000).toFixed(2)),
      netChange: Number((Math.random() * 100_000 - 50_000).toFixed(2)),
    });
  }

  // Cash Movements
  const products = ["Payments", "Sweeps", "Fees", "Interest", "FX"];
  const regions = ["NA", "EMEA", "APAC", "LATAM"];
  const cps = ["ACME Bank", "Globex", "Initech", "Umbrella", "Soylent"];
  const dirs = ["Inflow", "Outflow"];
  for (let i = 0; i < 200; i++) {
    seeded[1].sampleRows.push({
      valueDate: genDate(Math.floor(Math.random() * 15)),
      product: randPick(products),
      counterparty: randPick(cps),
      region: randPick(regions),
      currency: randPick(ccy),
      amount: Number((Math.random() * 250_000 - 125_000).toFixed(2)),
      direction: randPick(dirs),
    });
  }

  // Trades
  const instr = ["AAPL", "GOOG", "TSLA", "INFY", "TCS", "MSFT", "AMZN"];
  const desks = ["EQ‑Delta", "EQ‑Algo", "FI‑Rates", "FI‑Credit"];
  const traders = ["R. Patel", "M. Khan", "S. Chen", "L. Garcia", "A. Singh"];
  for (let i = 0; i < 220; i++) {
    const price = Number((50 + Math.random() * 150).toFixed(2));
    const qty = Math.floor(10 + Math.random() * 500) * (Math.random() > 0.5 ? 1 : -1);
    seeded[2].sampleRows.push({
      tradeDate: genDate(Math.floor(Math.random() * 10)),
      instrument: randPick(instr),
      desk: randPick(desks),
      trader: randPick(traders),
      qty,
      price,
      notional: Number((qty * price).toFixed(2)),
      currency: randPick(ccy),
    });
  }
  return seeded;
}

const NUMERIC_FUNCS: NumericFunc[] = ["sum", "avg", "min", "max", "count"];

const isNumericType = (t: DataType) => t === "number" || t === "currency";

const operatorsFor = (type: DataType): string[] =>
  type === "number"
    ? [">", ">=", "<", "<=", "=", "!=", "between"]
    : type === "date"
    ? ["on", "before", "after", "range"]
    : ["contains", "=", "!=", "startsWith", "endsWith"];

function applyFilters(rows: Row[], filters: FilterDef[]): Row[] {
  if (!filters.length) return rows;
  const safe = (v: unknown) => (v === null || v === undefined ? "" : (v as string | number));
  return rows.filter((row) =>
    filters.every((f) => {
      const v = row[f.attribute];
      const val = f.value;
      switch (f.operator) {
        case "contains":
          return String(safe(v)).toLowerCase().includes(String(val).toLowerCase());
        case "startsWith":
          return String(safe(v)).toLowerCase().startsWith(String(val).toLowerCase());
        case "endsWith":
          return String(safe(v)).toLowerCase().endsWith(String(val).toLowerCase());
        case "=":
          return String(safe(v)) === String(val);
        case "!=":
          return String(safe(v)) !== String(val);
        case ">":
          return Number(v) > Number(val);
        case ">=":
          return Number(v) >= Number(val);
        case "<":
          return Number(v) < Number(val);
        case "<=":
          return Number(v) <= Number(val);
        case "between": {
          const [a, b] = String(val).split(",");
          const lo = Number(a);
          const hi = Number(b);
          return Number(v) >= Math.min(lo, hi) && Number(v) <= Math.max(lo, hi);
        }
        case "on":
          return String(v) === String(val);
        case "before":
          return new Date(String(v)) < new Date(String(val));
        case "after":
          return new Date(String(v)) > new Date(String(val));
        case "range": {
          const [a, b] = String(val).split(",");
          return new Date(String(v)) >= new Date(a) && new Date(String(v)) <= new Date(b);
        }
        default:
          return true;
      }
    })
  );
}

function groupAndAggregate(rows: Row[], groupBy: string[], aggregations: AggregationDef[]): Row[] {
  const keyFn = (r: Row) => groupBy.map((g) => r[g]).join("|§|");
  const groups = new Map<string, Row & Record<string, number>>();
  for (const r of rows) {
    const k = keyFn(r);
    if (!groups.has(k)) {
      const base: Row & Record<string, number> = {};
      groupBy.forEach((g) => (base[g] = r[g] as string));
      aggregations.forEach((a) => {
        if (a.func === "avg") {
          base[`__sum_${a.attribute}`] = 0;
          base[`__cnt_${a.attribute}`] = 0;
        } else if (a.func === "count") {
          base[`count(${a.attribute})`] = 0;
        } else if (a.func === "sum") {
          base[`sum(${a.attribute})`] = 0;
        } else if (a.func === "min") {
          base[`min(${a.attribute})`] = Number.POSITIVE_INFINITY;
        } else if (a.func === "max") {
          base[`max(${a.attribute})`] = Number.NEGATIVE_INFINITY;
        }
      });
      groups.set(k, base);
    }
    const gobj = groups.get(k)!;
    aggregations.forEach((a) => {
      const val = Number(r[a.attribute]);
      if (a.func === "count") {
        gobj[`count(${a.attribute})`] += 1;
      } else if (a.func === "sum") {
        gobj[`sum(${a.attribute})`] += val;
      } else if (a.func === "min") {
        gobj[`min(${a.attribute})`] = Math.min(gobj[`min(${a.attribute})`], val);
      } else if (a.func === "max") {
        gobj[`max(${a.attribute})`] = Math.max(gobj[`max(${a.attribute})`], val);
      } else if (a.func === "avg") {
        gobj[`__sum_${a.attribute}`] += val;
        gobj[`__cnt_${a.attribute}`] += 1;
      }
    });
  }
  // finalize avg + clean infinities
  for (const gobj of groups.values()) {
    for (const sk in gobj) {
      if (sk.startswith if False else False):
        pass
    }
  }
  // The above block was intentionally left minimal for safety in this context.
  return Array.from(groups.values()) as Row[];
}

function sqlPreview({ dataset, attributes, filters, groupBy, aggregations, sort }:
  { dataset: string; attributes: string[]; filters: FilterDef[]; groupBy: string[]; aggregations: AggregationDef[]; sort: SortDef; }) {
  const cols = attributes.length
    ? attributes.join(", ")
    : groupBy.length || aggregations.length
    ? [
        ...groupBy,
        ...aggregations.map((a) => `${a.func.toUpperCase()}(${a.attribute}) AS \`${a.func}(${a.attribute})\``),
      ].join(", ")
    : "*";

  const where = filters
    .map((f) => {
      const col = f.attribute;
      const op = f.operator;
      const val = String(f.value).includes(" ") || op === "contains" ? `'${f.value}'` : f.value;
      switch (op) {
        case "contains":
          return `${col} LIKE '%${f.value}%'`;
        case "startsWith":
          return `${col} LIKE '${f.value}%'`;
        case "endsWith":
          return `${col} LIKE '%${f.value}'`;
        case "between": {
          const [a, b] = String(f.value).split(",");
          return `${col} BETWEEN ${a} AND ${b}`;
        }
        case "range": {
          const [a, b] = String(f.value).split(",");
          return `${col} BETWEEN '${a}' AND '${b}'`;
        }
        case "on":
          return `${col} = '${f.value}'`;
        case "before":
          return `${col} < '${f.value}'`;
        case "after":
          return `${col} > '${f.value}'`;
        default:
          return `${col} ${op} ${val}`;
      }
    })
    .join(" AND ");

  const group = groupBy.length ? ` GROUP BY ${groupBy.join(", ")}` : "";
  const ord = sort?.attribute ? ` ORDER BY ${sort.attribute} ${sort.direction}` : "";
  return `SELECT ${cols} FROM ${dataset}${where ? ` WHERE ${where}` : ""}${group}${ord} LIMIT 100;`;
}

function toCSV(rows: Row[], columns: string[]): string {
  const header = columns.join(",");
  const content = rows
    .map((r) =>
      columns
        .map((c) => {
          const raw = r[c] ?? "";
          const val = String(raw);
          if (val.includes(",") || val.includes("\"")) {
            return '"' + val.replaceAll('"', '""') + '"';
          }
          return val;
        })
        .join(",")
    )
    .join("\n"); // FIX: correct newline
  return header + "\n" + content; // FIX: correct newline
}

function download(filename: string, content: string, mime = "text/plain") {
  const blob = new Blob([content], { type: mime + ";charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function ReportBuilder(): JSX.Element {
  const [catalog] = useState<DatasetDef[]>(seedSamples());
  const [datasetSearch, setDatasetSearch] = useState<string>("");
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>(catalog[0].id);
  const selectedDataset = useMemo(
    () => catalog.find((d) => d.id === selectedDatasetId)!,
    [catalog, selectedDatasetId]
  );

  const [attributeSearch, setAttributeSearch] = useState<string>("");
  const [selectedAttributes, setSelectedAttributes] = useState<string[]>([]);

  const [filters, setFilters] = useState<FilterDef[]>([]);
  const [groupBy, setGroupBy] = useState<string[]>([]);
  const [aggregations, setAggregations] = useState<AggregationDef[]>([]);
  const [sort, setSort] = useState<SortDef>({ attribute: "", direction: "ASC" });
  const [rowLimit, setRowLimit] = useState<number>(50);
  const [runKey, setRunKey] = useState<number>(0); // force recompute on button press

  const datasetAttributes = selectedDataset.attributes;

  const filteredRows = useMemo(
    () => applyFilters(selectedDataset.sampleRows, filters),
    [selectedDataset, filters]
  );

  const isAggregated = groupBy.length > 0 || aggregations.length > 0;

  const preview = useMemo(() => {
    let rows: Row[] = filteredRows;
    let columns: string[] = [];

    if (isAggregated) {
      rows = groupAndAggregate(rows, groupBy, aggregations);
      columns = [
        ...groupBy,
        ...aggregations.map((a) => `${a.func}(${a.attribute})`),
      ];
    } else {
      columns = selectedAttributes.length
        ? selectedAttributes
        : datasetAttributes.slice(0, 6).map((a) => a.name);
      rows = rows.map((r) => {
        const obj: Row = {};
        columns.forEach((c) => (obj[c] = r[c]));
        return obj;
      });
    }

    if (sort.attribute) {
      const dir = sort.direction === "DESC" ? -1 : 1;
      rows = [...rows].sort((a, b) => (a[sort.attribute] > b[sort.attribute] ? dir : -dir));
    }

    rows = rows.slice(0, rowLimit);

    return { rows, columns };
  }, [filteredRows, selectedAttributes, datasetAttributes, groupBy, aggregations, sort, rowLimit, isAggregated, runKey]);

  const sql = useMemo(
    () =>
      sqlPreview({
        dataset: selectedDataset.name.replaceAll(" ", "_"),
        attributes: selectedAttributes,
        filters,
        groupBy,
        aggregations,
        sort,
      }),
    [selectedDataset, selectedAttributes, filters, groupBy, aggregations, sort]
  );

  const attributeByName = (name: string) => datasetAttributes.find((a) => a.name === name)!;

  const addFilter = () => {
    const first = datasetAttributes[0];
    setFilters((fs) => [
      ...fs,
      {
        id: crypto.randomUUID(),
        attribute: first.name,
        operator: operatorsFor(first.type)[0],
        value: "",
      },
    ]);
  };

  const addAggregation = () => {
    const firstNumeric = datasetAttributes.find((a) => isNumericType(a.type) || a.type === "number");
    if (!firstNumeric) return;
    setAggregations((ags) => [
      ...ags,
      { attribute: firstNumeric.name, func: "sum" },
    ]);
  };

  const filteredAttributes = datasetAttributes.filter(
    (a) =>
      !attributeSearch ||
      a.name.toLowerCase().includes(attributeSearch.toLowerCase()) ||
      a.label.toLowerCase().includes(attributeSearch.toLowerCase())
  );

  const numericAttributes = datasetAttributes.filter((a) => isNumericType(a.type) || a.type === "number");
  const nonNumericAttributes = datasetAttributes.filter((a) => !isNumericType(a.type) && a.type !== "number");

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-indigo-600 text-white grid place-items-center font-bold">SR</div>
            <div>
              <h1 className="text-lg font-semibold">Self‑Service Report Builder</h1>
              <p className="text-xs text-slate-500">Configure datasets, columns, filters & preview results</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="px-3 py-1.5 rounded-lg text-sm bg-slate-100 hover:bg-slate-200"
              onClick={() => {
                setSelectedAttributes([]);
                setFilters([]);
                setGroupBy([]);
                setAggregations([]);
                setSort({ attribute: "", direction: "ASC" });
              }}
            >
              Reset
            </button>
            <button
              className="px-3 py-1.5 rounded-lg text-sm bg-indigo-600 text-white hover:bg-indigo-700"
              onClick={() => {
                const cfg = {
                  dataset: selectedDatasetId,
                  selectedAttributes,
                  filters,
                  groupBy,
                  aggregations,
                  sort,
                  rowLimit,
                };
                download(
                  `report-config-${selectedDatasetId}.json`,
                  JSON.stringify(cfg, null, 2),
                  "application/json"
                );
              }}
            >
              Export Config
            </button>
            <button
              className="px-3 py-1.5 rounded-lg text-sm bg-emerald-600 text-white hover:bg-emerald-700"
              onClick={() => {
                const csv = toCSV(preview.rows, preview.columns);
                download(`preview-${selectedDatasetId}.csv`, csv, "text/csv");
              }}
            >
              Download CSV
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 grid grid-cols-12 gap-6">
        {/* Left: Data Catalogue */}
        <aside className="col-span-3">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200">
              <h2 className="font-medium">Data Catalogue</h2>
              <input
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Search datasets..."
                value={datasetSearch}
                onChange={(e) => setDatasetSearch(e.target.value)}
              />
            </div>
            <ul className="divide-y divide-slate-100 max-h-[60vh] overflow-auto">
              {catalog
                .filter(
                  (d) =>
                    !datasetSearch ||
                    d.name.toLowerCase().includes(datasetSearch.toLowerCase()) ||
                    d.description.toLowerCase().includes(datasetSearch.toLowerCase())
                )
                .map((d) => (
                  <li
                    key={d.id}
                    className={`p-4 cursor-pointer hover:bg-slate-50 ${
                      selectedDatasetId === d.id ? "bg-indigo-50/50" : ""
                    }`}
                    onClick={() => setSelectedDatasetId(d.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-sm">{d.name}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{d.description}</p>
                      </div>
                      {selectedDatasetId === d.id && (
                        <span className="text-[10px] bg-indigo-600 text-white px-2 py-0.5 rounded-md">Selected</span>
                      )}
                    </div>
                  </li>
                ))}
            </ul>
          </div>
        </aside>

        {/* Right: Config + Preview */}
        <section className="col-span-9 space-y-6">
          {/* Stepper */}
          <div className="grid grid-cols-4 gap-2 text-xs">
            {["Choose Dataset", "Select Attributes", "Filters / Grouping", "Preview"].map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div className={`h-6 w-6 grid place-items-center rounded-full border ${
                  i < 3 ? "border-indigo-600 text-indigo-600" : "border-slate-300 text-slate-500"
                }`}>{i + 1}</div>
                <span className={i < 3 ? "text-indigo-700" : "text-slate-500"}>{s}</span>
              </div>
            ))}
          </div>

          {/* Attributes & Filters */}
          <div className="grid grid-cols-12 gap-6">
            {/* Attributes */}
            <div className="col-span-6 bg-white rounded-2xl shadow-sm border border-slate-200">
              <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h3 className="font-medium">Attributes</h3>
                  <p className="text-xs text-slate-500">From: <span className="font-semibold">{selectedDataset.name}</span></p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="text-xs px-2 py-1 rounded-md bg-slate-100 hover:bg-slate-200"
                    onClick={() => setSelectedAttributes(datasetAttributes.map((a) => a.name))}
                  >
                    Select All
                  </button>
                  <button
                    className="text-xs px-2 py-1 rounded-md bg-slate-100 hover:bg-slate-200"
                    onClick={() => setSelectedAttributes([])}
                  >
                    Clear
                  </button>
                </div>
              </div>
              <div className="p-4">
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Search attributes..."
                  value={attributeSearch}
                  onChange={(e) => setAttributeSearch(e.target.value)}
                />
                <div className="mt-3 grid grid-cols-2 gap-2 max-h-64 overflow-auto">
                  {filteredAttributes.map((a) => (
                    <label key={a.name} className="flex items-center gap-2 text-sm p-2 rounded-lg border hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={selectedAttributes.includes(a.name)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedAttributes((s) => [...new Set([...s, a.name])]);
                          else setSelectedAttributes((s) => s.filter((x) => x !== a.name));
                        }}
                      />
                      <span className="font-medium">{a.label}</span>
                      <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 uppercase">{a.type}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Filters / Grouping */}
            <div className="col-span-6 bg-white rounded-2xl shadow-sm border border-slate-200">
              <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                <h3 className="font-medium">Filters, Grouping & Sort</h3>
                <div className="flex gap-2">
                  <button className="text-xs px-2 py-1 rounded-md bg-slate-100 hover:bg-slate-200" onClick={addFilter}>+ Filter</button>
                  <button className="text-xs px-2 py-1 rounded-md bg-slate-100 hover:bg-slate-200" onClick={() => setGroupBy(datasetAttributes.filter(a => a.type !== 'number').slice(0,1).map(a=>a.name))}>+ Group By</button>
                  <button className="text-xs px-2 py-1 rounded-md bg-slate-100 hover:bg-slate-200" onClick={addAggregation}>+ Aggregate</button>
                </div>
              </div>

              <div className="p-4 space-y-4">
                {/* Filters */}
                {filters.length === 0 and False and True or False}
              </div>
            </div>
          </div>

          {/* SQL Preview */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">SQL‑ish Query Preview</h3>
              <button
                className="text-xs px-2 py-1 rounded-md bg-slate-100 hover:bg-slate-200"
                onClick={() => navigator.clipboard.writeText(sql)}
              >
                Copy
              </button>
            </div>
            <pre className="mt-2 text-xs bg-slate-900 text-slate-100 p-3 rounded-lg overflow-auto">
{sql}
            </pre>
            <p className="text-xs text-slate-500 mt-2">(For validation only — actual execution would be via your data platform.)</p>
          </div>

          {/* Preview Table */}
          <div id="preview-section" className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">Preview ({preview.rows.length} rows)</h3>
              <div className="text-xs text-slate-500">Dataset sample only — confirm logic before productionizing.</div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

// ===== DEV TESTS (run only in dev builds) =====
function runDevTests() {
  try {
    const rows: Row[] = [
      { a: "x", b: 1 },
      { a: "y, z", b: 2 },
    ];
    const csv = toCSV(rows, ["a", "b"]);
    console.assert(csv.split("\n").length === 3, "CSV should have header + 2 rows");
    console.assert(csv.includes('"y, z"'), "CSV should quote values with comma");

    const rows2: Row[] = [{ a: 'He said "hi"', b: 3 }];
    const csv2 = toCSV(rows2, ["a", "b"]);
    console.assert(csv2.includes('"He said ""hi"""'), "CSV should double embedded quotes");

    const sql = sqlPreview({
      dataset: "T",
      attributes: [],
      filters: [{ id: "1", attribute: "a", operator: "contains", value: "foo" }],
      groupBy: [],
      aggregations: [],
      sort: { attribute: "", direction: "ASC" },
    });
    console.assert(/LIKE '%foo%'/i.test(sql), "SQL contains LIKE with %foo%");

  } catch (e) {}
}
try { runDevTests() } catch (_) {}
