"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Send,
  Paperclip,
  ChevronDown,
  HelpCircle,
  X,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";

const TITLE_MAX_LENGTH = 120;
const DESCRIPTION_MAX_LENGTH = 2000;
const MAX_FILE_SIZE = 10 * 1024 * 1024;

type Option = { id: string; name: string };

export default function AskQuestionPage() {
  const router = useRouter();
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [institutionId, setInstitutionId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [courseCode, setCourseCode] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [institutions, setInstitutions] = useState<Option[]>([]);
  const [departments, setDepartments] = useState<Option[]>([]);
  const [departmentId, setDepartmentId] = useState("");
  const [courses, setCourses] = useState<Option[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(false);

  // Load institutions on mount + pre-fill from user profile
  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();

      const { data: instData } = await supabase
        .from("institutions")
        .select("id, name")
        .order("name");
      setInstitutions(instData ?? []);

      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("institution_id, department_id")
          .eq("id", user.id)
          .single();

        if (profile?.institution_id) setInstitutionId(profile.institution_id);
        if (profile?.department_id) setDepartmentId(profile.department_id);
      }
    }
    load();
  }, []);

  // Load departments when institution changes
  useEffect(() => {
    setDepartmentId("");
    setDepartments([]);
    setCourseId("");
    setCourses([]);
    if (!institutionId) return;

    supabase
      .from("departments")
      .select("id, name")
      .eq("institution_id", institutionId)
      .order("name")
      .then(({ data }) => setDepartments(data ?? []));
  }, [institutionId]);

  // Load courses when department changes
  useEffect(() => {
    setCourseId("");
    setCourses([]);
    if (!departmentId) return;
    setLoadingCourses(true);

    supabase
      .from("courses")
      .select("id, name")
      .eq("department_id", departmentId)
      .order("name")
      .then(({ data }) => {
        setCourses(data ?? []);
        setLoadingCourses(false);
      });
  }, [departmentId]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setFileError("");
    if (!file) { setSelectedFile(null); return; }
    if (file.size > MAX_FILE_SIZE) {
      setSelectedFile(null);
      setFileError("File is too large. Max size is 10 MB.");
      e.target.value = "";
      return;
    }
    setSelectedFile(file);
  }

  function removeFile() {
    setSelectedFile(null);
    setFileError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    if (!title.trim() || !description.trim() || !institutionId || !courseId) return;
    if (fileError) return;

    setIsSubmitting(true);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setError("Session expired. Please log in again.");
      setIsSubmitting(false);
      return;
    }

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/community/questions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            title: title.trim(),
            description: description.trim(),
            institution_id: institutionId,
            course_id: courseId,
            course_code: courseCode.trim().toUpperCase() || null,
          }),
        }
      );

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.detail ?? "Failed to post question.");
      }

      router.push("/community");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const formValid =
    title.trim().length > 0 &&
    description.trim().length > 0 &&
    institutionId !== "" &&
    courseId !== "" &&
    !fileError;

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl px-6 py-10">

        {/* Back */}
        <Link
          href="/community"
          className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-blue-600"
        >
          <ArrowLeft size={18} />
          Back to Community
        </Link>

        {/* Header */}
        <div className="mb-8">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-600">
            <HelpCircle size={25} />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950 md:text-4xl">
            Ask a Question
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
            Stuck on a topic or assignment? Ask the SparkL community and get
            help from other students.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
            <X size={18} className="mt-0.5 shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-slate-950">Question Details</h2>
              <p className="mt-1 text-sm text-slate-500">
                Give enough context so others can understand what you need help with.
              </p>
            </div>

            <div className="space-y-6">

              {/* Title */}
              <div>
                <div className="mb-2 flex items-center justify-between gap-4">
                  <label htmlFor="title" className="block text-sm font-semibold text-slate-800">
                    Question Title
                  </label>
                  <span className="text-xs text-slate-400">{title.length}/{TITLE_MAX_LENGTH}</span>
                </div>
                <input
                  id="title"
                  type="text"
                  value={title}
                  maxLength={TITLE_MAX_LENGTH}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. How do I solve this integration problem?"
                  required
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                />
                <p className="mt-2 text-xs text-slate-400">Keep your title clear and specific.</p>
              </div>

              {/* Description */}
              <div>
                <div className="mb-2 flex items-center justify-between gap-4">
                  <label htmlFor="description" className="block text-sm font-semibold text-slate-800">
                    Describe Your Question
                  </label>
                  <span className="text-xs text-slate-400">{description.length}/{DESCRIPTION_MAX_LENGTH}</span>
                </div>
                <textarea
                  id="description"
                  value={description}
                  maxLength={DESCRIPTION_MAX_LENGTH}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Explain the problem, what you've tried, and where you're stuck..."
                  required
                  rows={7}
                  className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                />
                <p className="mt-2 text-xs text-slate-400">
                  The more context you provide, the easier it is for someone to help.
                </p>
              </div>

              {/* Institution + Department */}
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-800">
                    Institution <span className="text-blue-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={institutionId}
                      onChange={(e) => setInstitutionId(e.target.value)}
                      required
                      className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-4 py-3 pr-10 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                    >
                      <option value="">Select institution</option>
                      {institutions.map((i) => (
                        <option key={i.id} value={i.id}>{i.name}</option>
                      ))}
                    </select>
                    <ChevronDown size={18} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-800">
                    Department <span className="text-blue-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={departmentId}
                      onChange={(e) => setDepartmentId(e.target.value)}
                      disabled={!institutionId || departments.length === 0}
                      required
                      className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-4 py-3 pr-10 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="">
                        {!institutionId ? "Select institution first" : "Select department"}
                      </option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                    <ChevronDown size={18} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  </div>
                </div>
              </div>

              {/* Course + Course Code */}
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-800">
                    Course <span className="text-blue-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={courseId}
                      onChange={(e) => setCourseId(e.target.value)}
                      disabled={!departmentId || loadingCourses}
                      required
                      className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-4 py-3 pr-10 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="">
                        {loadingCourses ? "Loading courses…" : !departmentId ? "Select department first" : "Select course"}
                      </option>
                      {courses.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    <ChevronDown size={18} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  </div>
                </div>

                <div>
                  <label htmlFor="courseCode" className="mb-2 block text-sm font-semibold text-slate-800">
                    Course Code{" "}
                    <span className="font-normal text-slate-400">(optional)</span>
                  </label>
                  <input
                    id="courseCode"
                    type="text"
                    value={courseCode}
                    maxLength={20}
                    onChange={(e) => setCourseCode(e.target.value)}
                    placeholder="e.g. MTH 201"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm uppercase text-slate-900 outline-none transition placeholder:normal-case placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                  />
                </div>
              </div>

              {/* Attachment */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-800">
                  Attachment{" "}
                  <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.pdf,.doc,.docx"
                  onChange={handleFileChange}
                  className="hidden"
                />
                {!selectedFile ? (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex w-full items-center justify-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 py-6 text-sm text-slate-500 transition hover:border-blue-400 hover:bg-blue-50/50 hover:text-blue-600"
                  >
                    <Paperclip size={19} />
                    Attach an image or document
                  </button>
                ) : (
                  <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-blue-600">
                      <Paperclip size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-800">{selectedFile.name}</p>
                      <p className="mt-0.5 text-xs text-slate-400">
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={removeFile}
                      className="rounded-lg p-2 text-slate-400 transition hover:bg-white hover:text-slate-700"
                    >
                      <X size={17} />
                    </button>
                  </div>
                )}
                {fileError && (
                  <p className="mt-2 text-xs font-medium text-red-600">{fileError}</p>
                )}
              </div>
            </div>
          </div>

          {/* Guidelines */}
          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
            <h3 className="text-sm font-semibold text-blue-900">Before you post</h3>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-blue-800">
              <li>• Make your question clear and specific.</li>
              <li>• Include the course and institution.</li>
              <li>• Show what you have tried when possible.</li>
              <li>• Be respectful when interacting with other students.</li>
            </ul>
          </div>

          {/* Actions */}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Link
              href="/community"
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={!formValid || isSubmitting}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? (
                <><Loader2 size={17} className="animate-spin" /> Posting...</>
              ) : (
                <><Send size={17} /> Post Question</>
              )}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}