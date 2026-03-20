import { useEffect, useMemo, useState } from "react";

import { toast } from "sonner";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useAuth } from "@/contexts/AuthContext";
import { getToken, schoolsApi, School } from "@/lib/api";

const envApiBase = import.meta.env.VITE_API_URL || "http://localhost:3000";
// Ensure we always include `/api` exactly once (handle trailing slashes too).
const API_BASE_URL = /\/api\/?$/.test(envApiBase)
  ? envApiBase.replace(/\/$/, "")
  : `${envApiBase.replace(/\/$/, "")}/api`;

export default function TutorPDFIngestionPage() {
  const { logout, user } = useAuth();
  const [isLoadingSchools, setIsLoadingSchools] = useState(true);
  const [schools, setSchools] = useState<School[]>([]);

  const [selectedSchoolId, setSelectedSchoolId] = useState<string>("");
  const selectedSchool = useMemo(
    () => schools.find((s) => s.id === selectedSchoolId) || null,
    [schools, selectedSchoolId]
  );

  const [classLevel, setClassLevel] = useState<string>("9");
  const [subject, setSubject] = useState<string>("");
  const [topic, setTopic] = useState<string>("");
  const [resetIndex, setResetIndex] = useState<boolean>(false);
  const [pdfFiles, setPdfFiles] = useState<File[]>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    const load = async () => {
      setIsLoadingSchools(true);
      try {
        const data = await schoolsApi.getAll();
        setSchools(data);
        if (data.length > 0) {
          setSelectedSchoolId(data[0].id);
        }
      } catch (e: any) {
        toast.error(e?.message || "Failed to load schools");
      } finally {
        setIsLoadingSchools(false);
      }
    };
    void load();
  }, []);

  const handleLogout = () => {
    logout();
  };

  const canSubmit = useMemo(() => {
    return (
      !!selectedSchoolId &&
      !!classLevel &&
      !!subject.trim() &&
      pdfFiles.length > 0 &&
      !isSubmitting
    );
  }, [selectedSchoolId, classLevel, subject, pdfFiles.length, isSubmitting]);

  const submit = async () => {
    setUploadMessage(null);
    if (!getToken()) {
      toast.error("Missing auth token. Please login again.");
      setUploadMessage({ type: "error", text: "Missing auth token. Please login again." });
      return;
    }
    if (!selectedSchoolId) {
      toast.error("Please select a school.");
      setUploadMessage({ type: "error", text: "Please select a school." });
      return;
    }
    if (!subject.trim()) {
      toast.error("Subject is required.");
      setUploadMessage({ type: "error", text: "Subject is required." });
      return;
    }
    if (pdfFiles.length === 0) {
      toast.error("Please select at least one PDF.");
      setUploadMessage({ type: "error", text: "Please select at least one PDF." });
      return;
    }

    setIsSubmitting(true);
    try {
      const token = getToken();
      const formData = new FormData();

      formData.append("schoolId", selectedSchoolId);
      formData.append("classLevel", classLevel);
      formData.append("subject", subject.trim());
      // IMPORTANT: store exact textbox text (no forced trim() to preserve wording).
      // Validation uses trim() only for emptiness.
      // Topic is optional for "whole book" uploads. Empty means: no topic filtering later.
      formData.append("topic", topic);
      formData.append("resetIndex", resetIndex ? "true" : "false");

      for (const f of pdfFiles) {
        formData.append("pdfFiles", f, f.name);
      }

      const resp = await fetch(`${API_BASE_URL}/tutor/ingest`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        toast.error(data?.error || "Tutor PDF ingestion failed");
        setUploadMessage({
          type: "error",
          text: data?.error || "Tutor PDF ingestion failed",
        });
        return;
      }

      toast.success("Tutor knowledge base updated successfully!");
      setUploadMessage({
        type: "success",
        text: "Upload successful. Tutor knowledge base updated.",
      });
      setPdfFiles([]);
      setResetIndex(false);
    } catch (e: any) {
      toast.error(e?.message || "Tutor PDF ingestion failed");
      setUploadMessage({
        type: "error",
        text: e?.message || "Tutor PDF ingestion failed",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DashboardLayout
      role="superadmin"
      userName={user?.name || "Platform Admin"}
      onLogout={handleLogout}
    >
      <div className="space-y-6 max-w-4xl">
        <div>
          <h1 className="page-title">Tutor PDF Ingestion</h1>
          <p className="text-muted-foreground mt-1">
            Upload syllabus PDFs for a school to build the Tutor FAISS knowledge base.
          </p>
        </div>

        <div className="space-y-4 border border-border rounded-lg p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>School *</Label>
              <Select
                value={selectedSchoolId}
                onValueChange={(v) => setSelectedSchoolId(v)}
                disabled={isLoadingSchools}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select school" />
                </SelectTrigger>
                <SelectContent>
                  {schools.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedSchool?.board ? (
                <div className="text-xs text-muted-foreground mt-2">
                  Board (from school): <span className="font-medium">{selectedSchool.board}</span>
                </div>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label>Class *</Label>
              <Select value={classLevel} onValueChange={(v) => setClassLevel(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select class" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="8">8</SelectItem>
                  <SelectItem value="9">9</SelectItem>
                  <SelectItem value="10">10</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tutorSubject">Subject *</Label>
              <Input
                id="tutorSubject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Mathematics / Physics / Biology / Social Studies / English"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tutorTopic">Topic (optional)</Label>
              <Input
                id="tutorTopic"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g., Motion, Gravitation, Ecosystem..."
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Checkbox checked={resetIndex} onCheckedChange={(v) => setResetIndex(!!v)} />
            <Label className="font-normal">Reset existing FAISS index for this school</Label>
          </div>

          <div className="space-y-2">
            <Label>PDF files *</Label>
            <Input
              type="file"
              accept="application/pdf"
              multiple
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                setPdfFiles(files);
              }}
            />

            {pdfFiles.length > 0 ? (
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Selected:</div>
                {pdfFiles.map((f) => (
                  <div key={f.name} className="text-sm flex items-center justify-between gap-3">
                    <span className="truncate">{f.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setPdfFiles((prev) => prev.filter((x) => x !== f))}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <Textarea
            className="hidden"
            value=""
            readOnly
            aria-hidden="true"
          />

          <div className="flex items-center justify-between gap-4 pt-2">
            <div className="text-xs text-muted-foreground">
              Uploading builds/updates FAISS at: <span className="font-medium">data/tutor_faiss_index/&lt;school_id&gt;/</span>
            </div>
            <Button onClick={() => void submit()} disabled={!canSubmit} className="min-w-44">
              {isSubmitting ? "Uploading..." : "Upload PDFs & Build Tutor KB"}
            </Button>
          </div>

          {uploadMessage ? (
            <div
              className={[
                "text-sm rounded-md px-3 py-2",
                uploadMessage.type === "success"
                  ? "bg-emerald-500/10 text-emerald-700"
                  : "bg-destructive/10 text-destructive",
              ].join(" ")}
              role="status"
            >
              {uploadMessage.text}
            </div>
          ) : null}
        </div>
      </div>
    </DashboardLayout>
  );
}

