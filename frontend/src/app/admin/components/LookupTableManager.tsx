"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Loader2, Pencil, X, Check, AlertCircle } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

interface Row {
  id: string;
  name: string;
  [key: string]: any;
}

interface Props {
  table: string;
  title: string;
  description: string;
  extraFields?: {
    key: string;
    label: string;
    type?: "text" | "select";
    optionsTable?: string;
  }[];
}

export default function LookupTableManager({
  table,
  title,
  description,
  extraFields = [],
}: Props) {
  const supabase = createClient();

  const [rows, setRows] = useState<Row[]>([]);
  const [refTables, setRefTables] = useState<Record<string, Row[]>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [newName, setNewName] = useState("");
  const [newExtra, setNewExtra] = useState<Record<string, string>>({});

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editExtra, setEditExtra] = useState<Record<string, string>>({});

  async function loadRows() {
    setLoading(true);
    const { data } = await supabase.from(table).select("*").order("name");
    setRows(data ?? []);
    setLoading(false);
  }

  async function loadRefTables() {
    const uniqueRefTables = Array.from(
      new Set(
        extraFields
          .filter((f) => f.type === "select" && f.optionsTable)
          .map((f) => f.optionsTable as string)
      )
    );
    const results: Record<string, Row[]> = {};
    for (const refTable of uniqueRefTables) {
      const { data } = await supabase.from(refTable).select("id, name").order("name");
      results[refTable] = data ?? [];
    }
    setRefTables(results);
  }

  useEffect(() => {
    loadRows();
    loadRefTables();
  }, [table]);

  async function handleAdd() {
    if (!newName.trim()) return;
    setSaving(true);
    setError("");
    const { error: insertError } = await supabase
      .from(table)
      .insert({ name: newName.trim(), ...newExtra });
    setSaving(false);
    if (insertError) { setError(insertError.message); return; }
    setNewName("");
    setNewExtra({});
    loadRows();
  }

  function startEdit(row: Row) {
    setEditingId(row.id);
    setEditName(row.name);
    const extras: Record<string, string> = {};
    extraFields.forEach((f) => { extras[f.key] = row[f.key] ?? ""; });
    setEditExtra(extras);
  }

  async function handleSaveEdit(id: string) {
    setSaving(true);
    setError("");
    const { error: updateError } = await supabase
      .from(table)
      .update({ name: editName.trim(), ...editExtra })
      .eq("id", id);
    setSaving(false);
    if (updateError) { setError(updateError.message); return; }
    setEditingId(null);
    loadRows();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this item? This cannot be undone.")) return;
    setError("");
    const { error: deleteError } = await supabase.from(table).delete().eq("id", id);
    if (deleteError) { setError(deleteError.message); return; }
    loadRows();
  }

  const inputClass =
    "h-11 w-full rounded-xl border border-white/10 bg-white/[0.06] px-4 text-sm text-white placeholder:text-slate-500 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition";

  const selectClass =
    "h-11 w-full rounded-xl border border-white/10 bg-[#0D1230] px-4 text-sm text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition";

  return (
    <div className="min-h-screen bg-[#07091A] px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-3xl">

        {/* Header */}
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-400 mb-2">
            Admin
          </p>
          <h1 className="text-3xl font-extrabold text-white">{title}</h1>
          <p className="mt-2 text-sm text-slate-500">{description}</p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Add new */}
        <div className="mb-6 rounded-2xl border border-white/[0.06] bg-[#0D1230] p-5">
          <p className="mb-4 text-sm font-semibold text-slate-300">Add New</p>
          <div className="flex flex-wrap gap-3">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              placeholder="Name"
              className={`flex-1 min-w-[180px] ${inputClass}`}
            />

            {extraFields.map((field) => (
              <div key={field.key} className="min-w-[180px] flex-1">
                {field.type === "select" ? (
                  <select
                    value={newExtra[field.key] ?? ""}
                    onChange={(e) =>
                      setNewExtra((prev) => ({ ...prev, [field.key]: e.target.value }))
                    }
                    className={selectClass}
                  >
                    <option value="" className="bg-[#0D1230]">{field.label}</option>
                    {(refTables[field.optionsTable ?? ""] ?? []).map((opt) => (
                      <option key={opt.id} value={opt.id} className="bg-[#0D1230]">
                        {opt.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    value={newExtra[field.key] ?? ""}
                    onChange={(e) =>
                      setNewExtra((prev) => ({ ...prev, [field.key]: e.target.value }))
                    }
                    placeholder={field.label}
                    className={inputClass}
                  />
                )}
              </div>
            ))}

            <button
              onClick={handleAdd}
              disabled={saving || !newName.trim()}
              className="flex h-11 items-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-50"
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
              Add
            </button>
          </div>
        </div>

        {/* List */}
        <div className="rounded-2xl border border-white/[0.06] bg-[#0D1230] overflow-hidden">
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
            </div>
          ) : rows.length === 0 ? (
            <p className="py-16 text-center text-sm text-slate-500">
              No entries yet. Add one above.
            </p>
          ) : (
            <>
              <div className="border-b border-white/[0.05] px-5 py-3">
                <span className="text-xs text-slate-600">{rows.length} {rows.length === 1 ? "entry" : "entries"}</span>
              </div>

              <div className="divide-y divide-white/[0.05]">
                {rows.map((row) => (
                  <div key={row.id} className="flex flex-wrap items-center justify-between gap-3 p-4">

                    {editingId === row.id ? (
                      <>
                        <div className="flex flex-1 flex-wrap gap-3">
                          <input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className={`flex-1 min-w-[160px] ${inputClass}`}
                          />
                          {extraFields.map((field) => (
                            <div key={field.key} className="min-w-[160px] flex-1">
                              {field.type === "select" ? (
                                <select
                                  value={editExtra[field.key] ?? ""}
                                  onChange={(e) =>
                                    setEditExtra((prev) => ({ ...prev, [field.key]: e.target.value }))
                                  }
                                  className={selectClass}
                                >
                                  <option value="" className="bg-[#0D1230]">{field.label}</option>
                                  {(refTables[field.optionsTable ?? ""] ?? []).map((opt) => (
                                    <option key={opt.id} value={opt.id} className="bg-[#0D1230]">
                                      {opt.name}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <input
                                  value={editExtra[field.key] ?? ""}
                                  onChange={(e) =>
                                    setEditExtra((prev) => ({ ...prev, [field.key]: e.target.value }))
                                  }
                                  className={inputClass}
                                />
                              )}
                            </div>
                          ))}
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={() => handleSaveEdit(row.id)}
                            disabled={saving}
                            className="flex items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-400 transition hover:bg-emerald-500/20 disabled:opacity-50"
                          >
                            {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                            Save
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-400 transition hover:bg-white/[0.08]"
                          >
                            <X size={13} />
                            Cancel
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <p className="font-medium text-white">{row.name}</p>
                          {extraFields.map((field) => {
                            if (field.type === "select" && field.optionsTable) {
                              const refRow = (refTables[field.optionsTable] ?? []).find(
                                (r) => r.id === row[field.key]
                              );
                              return (
                                <p key={field.key} className="mt-0.5 text-xs text-slate-500">
                                  {field.label}: <span className="text-slate-400">{refRow?.name ?? "—"}</span>
                                </p>
                              );
                            }
                            return (
                              <p key={field.key} className="mt-0.5 text-xs text-slate-500">
                                {field.label}: <span className="text-slate-400">{row[field.key] ?? "—"}</span>
                              </p>
                            );
                          })}
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={() => startEdit(row)}
                            className="flex items-center gap-1.5 rounded-lg border border-blue-500/20 bg-blue-500/10 px-3 py-2 text-xs font-semibold text-blue-400 transition hover:bg-blue-500/20"
                          >
                            <Pencil size={13} />
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(row.id)}
                            className="flex items-center gap-1.5 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-400 transition hover:bg-red-500/20"
                          >
                            <Trash2 size={13} />
                            Delete
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}