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
  Youtube // <-- The YouTube Icon
} from "lucide-react";
import {
  getRecords,
  createRecord,
  updateRecord,
  deleteRecord,
  type Record,
} from "@/lib/api";
import { Progress } from "@/components/ui/progress";

interface Toast {
  id: number;
  type: "success" | "error";
  message: string;
}

// Track the live publishing status for specific records
interface PublishTask {
  taskId: string;
  progress: number;
  status: string; // 'STARTING', 'PROGRESS', 'SUCCESS', 'FAILURE'
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
        <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
      ) : (
        <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
      )}
      <div className="flex-1">{toast.message}</div>
      <button
        type="button"
        title="Dismiss"
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
          <div className="w-10 h-10 bg-destructive/10 rounded-xl flex items-center justify-center shrink-0">
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
            {loading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Deleting…</> : <><Trash2 className="w-3.5 h-3.5" />Delete</>}
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
          <button type="button" onClick={onCancel} aria-label="Close edit modal" title="Close" className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="edit-title" className="block text-xs font-medium text-foreground">Title <span className="text-destructive">*</span></label>
            <input id="edit-title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus className="w-full h-10 px-3 rounded-xl border border-input bg-background text-sm outline-none transition-all focus:ring-2 focus:ring-ring" />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="edit-description" className="block text-xs font-medium text-foreground">Description</label>
            <textarea id="edit-description" value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className="w-full px-3 py-2.5 rounded-xl border border-input bg-background text-sm outline-none transition-all focus:ring-2 focus:ring-ring resize-none" />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onCancel} disabled={saving} className="flex-1 h-9 rounded-xl border border-input bg-background text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50">Cancel</button>
            <button type="submit" disabled={saving || !title.trim()} className="flex-1 h-9 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-1.5">
              {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Saving…</> : <><Pencil className="w-3.5 h-3.5" />Save Changes</>}
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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgressMsg, setUploadProgressMsg] = useState("");

  const [editingRecord, setEditingRecord] = useState<Record | null>(null);
  const [deletingRecord, setDeletingRecord] = useState<Record | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [toasts, setToasts] = useState<Toast[]>([]);
  
  // --- PHASE 3: AUTOMATION ENGINE TRACKING STATE ---
  const [publishTasks, setPublishTasks] = useState<{ [key: string | number]: PublishTask }>({});

  function addToast(type: "success" | "error", message: string) {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, type, message }]);
  }

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Securely wrapped to prevent React warnings
  const fetchRecords = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      navigate("/");
      return;
    }
    fetchRecords();
  }, [navigate, fetchRecords]);

  // --- THE POLLING ENGINE ---
  async function handlePublishToYouTube(recordId: string | number, videoKey: string, postTitle: string) {
    const token = localStorage.getItem("access_token");
    if (!token) {
      addToast("error", "Missing authentication token.");
      return;
    }

    // 1. Declare the variable cleanly above the fetch request
    const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

    // 2. Use backticks (`) and ${} to inject the variable into the string
    try {
      const res = await fetch(`${API_URL}/test-background-upload`, {
        method: "POST",
        headers: { 
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json" 
        },
        body: JSON.stringify({
          video_key: videoKey,
          title: postTitle
        })
      });

      if (!res.ok) throw new Error("Failed to secure job ticket from server.");
      const data = await res.json();
      const taskId = data.task_id;

      setPublishTasks(prev => ({ ...prev, [recordId]: { progress: 0, status: "PROCESSING", taskId } }));

      const interval = setInterval(async () => {
        try {
          const statusRes = await fetch(`${API_URL}/task-status/${taskId}`, {
            headers: { "Authorization": `Bearer ${token}` }
          });
          
          if (!statusRes.ok) return;
          const statusData = await statusRes.json();

          if (statusData.status === "SUCCESS") {
            setPublishTasks(prev => ({ ...prev, [recordId]: { progress: 100, status: "SUCCESS", taskId } }));
            clearInterval(interval);
            addToast("success", `"${postTitle}" was successfully published to YouTube!`);
          } else if (statusData.status === "FAILURE") {
            setPublishTasks(prev => ({ ...prev, [recordId]: { progress: 0, status: "FAILURE", taskId } }));
            clearInterval(interval);
            addToast("error", `Automation failed for "${postTitle}".`);
          } else {
            setPublishTasks(prev => ({
              ...prev,
              [recordId]: { progress: statusData.progress || 0, status: statusData.status, taskId }
            }));
          }
        } catch (e) {
          console.error("Polling error", e);
        }
      }, 1000); 

    } catch(err) {
      addToast("error", err instanceof Error ? err.message : "System error triggering automation.");
      setPublishTasks(prev => {
        const newState = { ...prev };
        delete newState[recordId];
        return newState;
      });
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    setUploadProgressMsg("");

    try {
      let finalDescription = description.trim();

      if (selectedFile) {
        setUploadProgressMsg("Requesting ticket...");
        const token = localStorage.getItem("access_token");
        const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

        const res = await fetch(
          `${API_URL}/generate-upload-url?file_name=${encodeURIComponent(selectedFile.name)}&file_type=${encodeURIComponent(selectedFile.type)}`,
          { 
            method: 'POST', 
            headers: { 'Authorization': `Bearer ${token}` } 
          }
        );

        if (!res.ok) throw new Error("FastAPI refused the upload ticket.");
        // 1. We receive the ticket from FastAPI
        const data = await res.json();
        const { upload_url, file_key } = data;

        // 2. DEV-OPS BYPASS: Strip the blocked Port 9000 from the URL so it routes through our Nginx Proxy on Port 80
        const proxiedUploadUrl = upload_url.replace(':9000', '');

        setUploadProgressMsg("Pushing massive file to MinIO via Nginx Proxy...");
        
        // 3. Use the new proxied URL for the upload
        const minioRes = await fetch(proxiedUploadUrl, {
          method: 'PUT', 
          body: selectedFile, 
          headers: { 'Content-Type': selectedFile.type },
        });

        if (!minioRes.ok) throw new Error("MinIO rejected the file upload.");
        finalDescription = finalDescription ? `${finalDescription}\n\n[Attached Video: ${file_key}]` : `[Attached Video: ${file_key}]`;
      }

      setUploadProgressMsg("Saving record...");
      const newRecord = await createRecord(title.trim(), finalDescription);
      
      setRecords((prev) => [newRecord, ...prev]);
      setTitle("");
      setDescription("");
      setSelectedFile(null);
      addToast("success", "Record & Video saved successfully.");
      
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Failed to create record.");
    } finally {
      setSubmitting(false);
      setUploadProgressMsg("");
    }
  }

  async function handleEdit(id: string | number, newTitle: string, newDescription: string) {
    try {
      const updated = await updateRecord(id, newTitle, newDescription);
      setRecords((prev) => prev.map((r) => (r.id === id ? updated : r)));
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
      <div className="fixed top-5 right-5 z-50 flex flex-col gap-2.5 items-end">
        {toasts.map((toast) => <ToastNotification key={toast.id} toast={toast} onDismiss={dismissToast} />)}
      </div>

      {deletingRecord && (
        <ConfirmDeleteModal record={deletingRecord} onConfirm={handleDelete} onCancel={() => !deleteLoading && setDeletingRecord(null)} loading={deleteLoading} />
      )}

      {editingRecord && (
        <EditModal record={editingRecord} onSave={handleEdit} onCancel={() => setEditingRecord(null)} />
      )}

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
              <span>{records.length} record{records.length !== 1 ? "s" : ""}</span>
            </div>
            <button onClick={handleLogout} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg hover:bg-muted">
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
                  <label htmlFor="title" className="block text-xs font-medium text-foreground">Title <span className="text-destructive">*</span></label>
                  <input id="title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Enter a title…" required className="w-full h-10 px-3 rounded-xl border border-input bg-background text-sm outline-none transition-all focus:ring-2 focus:ring-ring" />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="description" className="block text-xs font-medium text-foreground">Description</label>
                  <textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe this record…" rows={4} className="w-full px-3 py-2.5 rounded-xl border border-input bg-background text-sm outline-none transition-all focus:ring-2 focus:ring-ring resize-none" />
                </div>

                <div className="space-y-1.5 pt-2">
                  <label htmlFor="videoFile" className="block text-xs font-medium text-foreground">Video File (Optional)</label>
                  <input id="videoFile" type="file" accept="video/*" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} disabled={submitting} className="w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 transition-all cursor-pointer disabled:opacity-50" />
                </div>

                <button type="submit" disabled={submitting || !title.trim()} className="w-full h-10 bg-primary text-primary-foreground rounded-xl font-medium text-sm transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2">
                  {submitting ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />{uploadProgressMsg || "Saving..."}</> : <><Plus className="w-3.5 h-3.5" />Add Record</>}
                </button>
              </form>
            </div>
          </div>

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

            {loadingRecords && <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}</div>}

            {!loadingRecords && fetchError && (
              <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
                <div className="w-12 h-12 bg-destructive/10 rounded-2xl flex items-center justify-center"><AlertCircle className="w-5 h-5 text-destructive" /></div>
                <div><p className="text-sm font-medium text-foreground">Failed to load records</p><p className="text-xs text-muted-foreground mt-1">{fetchError}</p></div>
                <button onClick={fetchRecords} className="text-xs text-primary hover:underline font-medium">Try again</button>
              </div>
            )}

            {!loadingRecords && !fetchError && records.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
                <div className="w-12 h-12 bg-muted rounded-2xl flex items-center justify-center"><Database className="w-5 h-5 text-muted-foreground" /></div>
                <div><p className="text-sm font-medium text-foreground">No records yet</p><p className="text-xs text-muted-foreground mt-1">Create your first record using the form on the left.</p></div>
              </div>
            )}

            {!loadingRecords && !fetchError && records.length > 0 && (
              <div className="grid grid-cols-1 gap-4">
                {records.map((record) => {
                  const videoMatch = record.description?.match(/\[Attached Video: (.*?)\]/);
                  const videoKey = videoMatch ? videoMatch[1] : null;
                  const taskState = publishTasks[record.id];

                  return (
                    <div key={record.id} className="group bg-card border border-card-border rounded-2xl p-5 shadow-sm hover:shadow-md transition-all hover:border-border flex flex-col justify-between">
                      <div>
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <h3 className="font-semibold text-sm text-foreground leading-snug line-clamp-2 flex-1">{record.title}</h3>
                          <div className="flex items-center gap-1 shrink-0">
                            <button onClick={() => setEditingRecord(record)} title="Edit" className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/8 transition-colors opacity-0 group-hover:opacity-100"><Pencil className="w-3.5 h-3.5" /></button>
                            <button onClick={() => setDeletingRecord(record)} title="Delete" className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/8 transition-colors opacity-0 group-hover:opacity-100"><Trash2 className="w-3.5 h-3.5" /></button>
                            <span className="text-xs bg-primary/8 text-primary px-2 py-0.5 rounded-lg font-medium border border-primary/15">#{typeof record.id === "number" ? record.id : String(record.id).slice(0, 8)}</span>
                          </div>
                        </div>

                        {record.description && <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap mb-4">{record.description}</p>}
                      </div>

                      <div className="mt-auto pt-4 border-t border-border">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-1.5">
                            <FileText className="w-3 h-3 text-muted-foreground/60 shrink-0" />
                            <span className="text-xs text-muted-foreground">{formatDate(record.created_at)}</span>
                          </div>
                        </div>

                        {videoKey && (
                          <div className="bg-muted/50 rounded-xl p-3 border border-border/50">
                            {!taskState ? (
                              <button 
                                onClick={() => handlePublishToYouTube(record.id, videoKey, record.title)}
                                className="w-full flex items-center justify-center gap-2 bg-[#FF0000]/10 text-[#FF0000] hover:bg-[#FF0000]/20 h-9 rounded-lg text-xs font-semibold transition-all"
                              >
                                <Youtube className="w-4 h-4" />
                                Automate YouTube Publishing
                              </button>
                            ) : (
                              <div className="space-y-2">
                                <div className="flex items-center justify-between text-xs font-semibold text-foreground">
                                  <span className="flex items-center gap-2">
                                    {taskState.status === "SUCCESS" ? (
                                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                                    ) : (
                                      <Loader2 className="w-4 h-4 animate-spin text-primary" />
                                    )}
                                    {taskState.status === "SUCCESS" ? "Published!" : "Processing..."}
                                  </span>
                                  <span className="text-muted-foreground">{taskState.progress}%</span>
                                </div>
                                {(() => {
                                  const progressValue = Math.round(taskState.progress);

                                  return (
                                    <Progress value={progressValue} className="w-full" />
                                  );
                                })()}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}