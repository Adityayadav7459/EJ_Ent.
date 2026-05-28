import { useEffect, useState, useCallback } from "react";
import { useLocation } from "wouter";
import {
  LogOut,
  Plus,
  Loader2,
  Sparkles,
  FileText,
  AlertCircle,
  CheckCircle2,
  X,
  Database,
  Pencil,
  Trash2,
} from "lucide-react";
import {
  getRecords,
  createRecord,
  updateRecord,
  deleteRecord,
  type Record,
} from "@/lib/api";

interface Toast {
  id: number;
  type: "success" | "error";
  message: string;
}

let toastId = 0;

function formatDate(dateStr: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(dateStr));
  } catch {
    return dateStr;
  }
}

function SkeletonCard() {
  return (
    <div className="bg-card border border-card-border rounded-2xl p-5 space-y-3 animate-pulse">
      <div className="flex items-start justify-between gap-3">
        <div className="h-4 bg-muted rounded-lg w-2/3" />
        <div className="h-6 bg-muted rounded-lg w-16" />
      </div>
      <div className="space-y-2">
        <div className="h-3.5 bg-muted rounded-lg w-full" />
        <div className="h-3.5 bg-muted rounded-lg w-4/5" />
      </div>
      <div className="h-3 bg-muted rounded-lg w-1/3" />
    </div>
  );
}

function ToastNotification({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: number) => void;
}) {
  useEffect(() => {
    const t = setTimeout(() => onDismiss(toast.id), 4000);
    return () => clearTimeout(t);
  }, [toast.id, onDismiss]);

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3.5 rounded-xl shadow-lg border text-sm font-medium max-w-sm w-full transition-all ${
        toast.type === "success"
          ? "bg-card border-green-200 text-green-800"
          : "bg-card border-destructive/25 text-destructive"
      }`}
    >
      {toast.type === "success" ? (
        <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
      ) : (
        <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0" />
      )}
      <span className="flex-1">{toast.message}</span>
      <button
        onClick={() => onDismiss(toast.id)}
        className="text-muted-foreground hover:text-foreground transition-colors ml-1"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function ConfirmDeleteModal({
  record,
  onConfirm,
  onCancel,
  loading,
}: {
  record: Record;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onCancel}
      />
      <div className="relative bg-card border border-card-border rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-destructive/10 rounded-xl flex items-center justify-center flex-shrink-0">
            <Trash2 className="w-5 h-5 text-destructive" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Delete Record</h3>
            <p className="text-xs text-muted-foreground mt-0.5">This action cannot be undone</p>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          Are you sure you want to delete{" "}
          <span className="font-medium text-foreground">"{record.title}"</span>?
        </p>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 h-9 rounded-xl border border-input bg-background text-sm font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 h-9 rounded-xl bg-destructive text-destructive-foreground text-sm font-medium hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
          >
            {loading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Deleting…
              </>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function EditModal({
  record,
  onSave,
  onCancel,
}: {
  record: Record;
  onSave: (id: string | number, title: string, description: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(record.title);
  const [description, setDescription] = useState(record.description ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      await onSave(record.id, title.trim(), description.trim());
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onCancel}
      />
      <div className="relative bg-card border border-card-border rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center">
              <Pencil className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Edit Record</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                #{typeof record.id === "number" ? record.id : String(record.id).slice(0, 8)}
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-foreground">
              Title <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter a title…"
              required
              autoFocus
              className="w-full h-10 px-3 rounded-xl border border-input bg-background text-foreground placeholder:text-muted-foreground text-sm outline-none transition-all focus:ring-2 focus:ring-ring focus:border-transparent"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-foreground">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe this record…"
              rows={4}
              className="w-full px-3 py-2.5 rounded-xl border border-input bg-background text-foreground placeholder:text-muted-foreground text-sm outline-none transition-all focus:ring-2 focus:ring-ring focus:border-transparent resize-none"
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              className="flex-1 h-9 rounded-xl border border-input bg-background text-sm font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !title.trim()}
              className="flex-1 h-9 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
            >
              {saving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <Pencil className="w-3.5 h-3.5" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [, navigate] = useLocation();
  const [records, setRecords] = useState<Record[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [editingRecord, setEditingRecord] = useState<Record | null>(null);
  const [deletingRecord, setDeletingRecord] = useState<Record | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [toasts, setToasts] = useState<Toast[]>([]);

  function addToast(type: "success" | "error", message: string) {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, type, message }]);
  }

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      navigate("/");
      return;
    }
    fetchRecords();
  }, []);

  async function fetchRecords() {
    setLoadingRecords(true);
    setFetchError(null);
    try {
      const data = await getRecords();
      setRecords(data);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Failed to load records.");
    } finally {
      setLoadingRecords(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    try {
      const newRecord = await createRecord(title.trim(), description.trim());
      setRecords((prev) => [newRecord, ...prev]);
      setTitle("");
      setDescription("");
      addToast("success", "Record created successfully.");
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Failed to create record.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEdit(
    id: string | number,
    newTitle: string,
    newDescription: string
  ) {
    try {
      const updated = await updateRecord(id, newTitle, newDescription);
      setRecords((prev) =>
        prev.map((r) => (r.id === id ? updated : r))
      );
      setEditingRecord(null);
      addToast("success", "Record updated successfully.");
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Failed to update record.");
      throw err;
    }
  }

  async function handleDelete() {
    if (!deletingRecord) return;
    setDeleteLoading(true);
    try {
      await deleteRecord(deletingRecord.id);
      setRecords((prev) => prev.filter((r) => r.id !== deletingRecord.id));
      setDeletingRecord(null);
      addToast("success", "Record deleted.");
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Failed to delete record.");
    } finally {
      setDeleteLoading(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem("access_token");
    navigate("/");
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Toast notifications */}
      <div className="fixed top-5 right-5 z-50 flex flex-col gap-2.5 items-end">
        {toasts.map((toast) => (
          <ToastNotification key={toast.id} toast={toast} onDismiss={dismissToast} />
        ))}
      </div>

      {/* Modals */}
      {deletingRecord && (
        <ConfirmDeleteModal
          record={deletingRecord}
          onConfirm={handleDelete}
          onCancel={() => !deleteLoading && setDeletingRecord(null)}
          loading={deleteLoading}
        />
      )}

      {editingRecord && (
        <EditModal
          record={editingRecord}
          onSave={handleEdit}
          onCancel={() => setEditingRecord(null)}
        />
      )}

      {/* Top navigation */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-sm border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-primary/10 rounded-lg flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
            </div>
            <span className="font-semibold text-sm tracking-tight text-foreground">DataVault</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground bg-muted px-2.5 py-1.5 rounded-lg">
              <Database className="w-3 h-3" />
              <span>
                {records.length} record{records.length !== 1 ? "s" : ""}
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg hover:bg-muted"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage and explore your data records</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Section A: Create Entry */}
          <div className="lg:col-span-1">
            <div className="bg-card border border-card-border rounded-2xl p-6 shadow-sm sticky top-22">
              <div className="flex items-center gap-2.5 mb-5">
                <div className="w-8 h-8 bg-primary/10 rounded-xl flex items-center justify-center">
                  <Plus className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Create Entry</h2>
                  <p className="text-xs text-muted-foreground">Add a new record</p>
                </div>
              </div>

              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="title" className="block text-xs font-medium text-foreground">
                    Title <span className="text-destructive">*</span>
                  </label>
                  <input
                    id="title"
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Enter a title…"
                    required
                    className="w-full h-10 px-3 rounded-xl border border-input bg-background text-foreground placeholder:text-muted-foreground text-sm outline-none transition-all focus:ring-2 focus:ring-ring focus:border-transparent"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="description" className="block text-xs font-medium text-foreground">
                    Description
                  </label>
                  <textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe this record…"
                    rows={4}
                    className="w-full px-3 py-2.5 rounded-xl border border-input bg-background text-foreground placeholder:text-muted-foreground text-sm outline-none transition-all focus:ring-2 focus:ring-ring focus:border-transparent resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting || !title.trim()}
                  className="w-full h-10 bg-primary text-primary-foreground rounded-xl font-medium text-sm transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      Add Record
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>

          {/* Section B: Data Vault */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 bg-primary/10 rounded-xl flex items-center justify-center">
                <FileText className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">Data Vault</h2>
                <p className="text-xs text-muted-foreground">All your stored records</p>
              </div>
            </div>

            {/* Loading skeleton */}
            {loadingRecords && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <SkeletonCard key={i} />
                ))}
              </div>
            )}

            {/* Error state */}
            {!loadingRecords && fetchError && (
              <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
                <div className="w-12 h-12 bg-destructive/10 rounded-2xl flex items-center justify-center">
                  <AlertCircle className="w-5 h-5 text-destructive" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Failed to load records</p>
                  <p className="text-xs text-muted-foreground mt-1">{fetchError}</p>
                </div>
                <button
                  onClick={fetchRecords}
                  className="text-xs text-primary hover:underline font-medium"
                >
                  Try again
                </button>
              </div>
            )}

            {/* Empty state */}
            {!loadingRecords && !fetchError && records.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
                <div className="w-12 h-12 bg-muted rounded-2xl flex items-center justify-center">
                  <Database className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">No records yet</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Create your first record using the form on the left.
                  </p>
                </div>
              </div>
            )}

            {/* Records grid */}
            {!loadingRecords && !fetchError && records.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {records.map((record) => (
                  <div
                    key={record.id}
                    className="group bg-card border border-card-border rounded-2xl p-5 space-y-3 shadow-sm hover:shadow-md transition-all hover:border-border"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-semibold text-sm text-foreground leading-snug line-clamp-2 flex-1">
                        {record.title}
                      </h3>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => setEditingRecord(record)}
                          title="Edit record"
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/8 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeletingRecord(record)}
                          title="Delete record"
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/8 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-xs bg-primary/8 text-primary px-2 py-0.5 rounded-lg font-medium border border-primary/15">
                          #{typeof record.id === "number" ? record.id : String(record.id).slice(0, 8)}
                        </span>
                      </div>
                    </div>

                    {record.description && (
                      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                        {record.description}
                      </p>
                    )}

                    <div className="flex items-center gap-1.5 pt-1 border-t border-border">
                      <FileText className="w-3 h-3 text-muted-foreground/60 flex-shrink-0" />
                      <span className="text-xs text-muted-foreground">
                        {formatDate(record.created_at)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
