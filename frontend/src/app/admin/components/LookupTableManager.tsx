"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Loader2, Pencil, X, Check } from "lucide-react";

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

    const { data } = await supabase
      .from(table)
      .select("*")
      .order("name");

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
      const { data } = await supabase
        .from(refTable)
        .select("id, name")
        .order("name");
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

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setNewName("");
    setNewExtra({});
    loadRows();
  }

  function startEdit(row: Row) {
    setEditingId(row.id);
    setEditName(row.name);
    const extras: Record<string, string> = {};
    extraFields.forEach((f) => {
      extras[f.key] = row[f.key] ?? "";
    });
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

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setEditingId(null);
    loadRows();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this item? This cannot be undone.")) return;

    setError("");

    const { error: deleteError } = await supabase
      .from(table)
      .delete()
      .eq("id", id);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    loadRows();
  }

  return (
    <div>
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>

      {/* Add new row */}
      <div className="mt-6 rounded-2xl bg-white p-5 shadow-sm">
        <p className="mb-3 text-sm font-semibold text-slate-700">
          Add New
        </p>

        <div className="flex flex-wrap gap-3">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Name"
            className="h-11 flex-1 min-w-[180px] rounded-xl border border-slate-200 px-4 text-sm outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
          />

          {extraFields.map((field) => (
            <div key={field.key} className="min-w-[180px] flex-1">
              {field.type === "select" ? (
                <select
                  value={newExtra[field.key] ?? ""}
                  onChange={(e) =>
                    setNewExtra((prev) => ({
                      ...prev,
                      [field.key]: e.target.value,
                    }))
                  }
                  className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                >
                  <option value="">{field.label}</option>
                  {(refTables[field.optionsTable ?? ""] ?? []).map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.name}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  value={newExtra[field.key] ?? ""}
                  onChange={(e) =>
                    setNewExtra((prev) => ({
                      ...prev,
                      [field.key]: e.target.value,
                    }))
                  }
                  placeholder={field.label}
                  className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                />
              )}
            </div>
          ))}

          <button
            onClick={handleAdd}
            disabled={saving || !newName.trim()}
            className="flex h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-blue-700 to-blue-500 px-5 text-sm font-semibold text-white transition hover:scale-[1.02] disabled:opacity-60"
          >
            {saving ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Plus size={16} />
            )}
            Add
          </button>
        </div>

        {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
      </div>

      {/* List */}
      <div className="mt-6 rounded-2xl bg-white shadow-sm">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
          </div>
        ) : rows.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-500">
            No entries yet.
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {rows.map((row) => (
              <div
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-3 p-4"
              >
                {editingId === row.id ? (
                  <>
                    <div className="flex flex-1 flex-wrap gap-3">
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="h-10 flex-1 min-w-[160px] rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-600"
                      />

                      {extraFields.map((field) => (
                        <div key={field.key} className="min-w-[160px] flex-1">
                          {field.type === "select" ? (
                            <select
                              value={editExtra[field.key] ?? ""}
                              onChange={(e) =>
                                setEditExtra((prev) => ({
                                  ...prev,
                                  [field.key]: e.target.value,
                                }))
                              }
                              className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-600"
                            >
                              <option value="">{field.label}</option>
                              {(refTables[field.optionsTable ?? ""] ?? []).map(
                                (opt) => (
                                  <option key={opt.id} value={opt.id}>
                                    {opt.name}
                                  </option>
                                )
                              )}
                            </select>
                          ) : (
                            <input
                              value={editExtra[field.key] ?? ""}
                              onChange={(e) =>
                                setEditExtra((prev) => ({
                                  ...prev,
                                  [field.key]: e.target.value,
                                }))
                              }
                              className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-600"
                            />
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSaveEdit(row.id)}
                        disabled={saving}
                        className="rounded-lg bg-green-50 p-2 text-green-600 hover:bg-green-100"
                      >
                        <Check size={18} />
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="rounded-lg bg-slate-50 p-2 text-slate-500 hover:bg-slate-100"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <p className="font-medium text-slate-900">
                        {row.name}
                      </p>
                      {extraFields.map((field) => {
                        if (field.type === "select" && field.optionsTable) {
                          const refRow = (
                            refTables[field.optionsTable] ?? []
                          ).find((r) => r.id === row[field.key]);
                          return (
                            <p key={field.key} className="text-sm text-slate-500">
                              {field.label}: {refRow?.name ?? "—"}
                            </p>
                          );
                        }
                        return (
                          <p key={field.key} className="text-sm text-slate-500">
                            {field.label}: {row[field.key] ?? "—"}
                          </p>
                        );
                      })}
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => startEdit(row)}
                        className="rounded-lg bg-blue-50 p-2 text-blue-600 hover:bg-blue-100"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(row.id)}
                        className="rounded-lg bg-red-50 p-2 text-red-500 hover:bg-red-100"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}