"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import {
  ArrowLeft,
  Send,
  Paperclip,
  ChevronDown,
  HelpCircle,
  X,
  CheckCircle2,
} from "lucide-react";

const institutions = [
  "University of Lagos",
  "Yaba College of Technology",
  "University of Ibadan",
  "University of Nigeria, Nsukka",
  "Lagos State University",
  "Other",
];

const courses = [
  "Computer Science",
  "Computer Engineering",
  "Electrical Engineering",
  "Mathematics",
  "Physics",
  "Chemistry",
  "Other",
];

const TITLE_MAX_LENGTH = 120;
const DESCRIPTION_MAX_LENGTH = 2000;
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export default function AskQuestionPage() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [institution, setInstitution] = useState("");
  const [course, setCourse] = useState("");
  const [courseCode, setCourseCode] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPosted, setIsPosted] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];

    setFileError("");

    if (!file) {
      setSelectedFile(null);
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setSelectedFile(null);
      setFileError("File is too large. Please choose a file under 10 MB.");
      event.target.value = "";
      return;
    }

    setSelectedFile(file);
  };

  const removeFile = () => {
    setSelectedFile(null);
    setFileError("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!title.trim() || !description.trim() || !institution || !course) {
      return;
    }

    if (fileError) {
      return;
    }

    setIsSubmitting(true);
    setIsPosted(false);

    // Backend integration will replace this with the real API/Supabase call.
    const questionPayload = {
      title: title.trim(),
      description: description.trim(),
      institution,
      course,
      courseCode: courseCode.trim().toUpperCase(),
      attachment: selectedFile
        ? {
            name: selectedFile.name,
            type: selectedFile.type,
            size: selectedFile.size,
          }
        : null,
    };

    console.log("Question payload:", questionPayload);

    await new Promise((resolve) => setTimeout(resolve, 800));

    setIsSubmitting(false);
    setIsPosted(true);
  };

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
            Stuck on a topic or assignment? Ask the Sparkle community and get
            help from other students and learners.
          </p>
        </div>

        {/* Success message */}
        {isPosted && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
            <CheckCircle2 size={20} className="mt-0.5 shrink-0" />

            <div>
              <p className="text-sm font-semibold">
                Your question is ready to be submitted.
              </p>
              <p className="mt-1 text-sm text-emerald-700">
                The backend team will connect this form to the question
                database.
              </p>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-slate-950">
                Question Details
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Give enough information so others can understand what you need
                help with.
              </p>
            </div>

            <div className="space-y-6">
              {/* Title */}
              <div>
                <div className="mb-2 flex items-center justify-between gap-4">
                  <label
                    htmlFor="title"
                    className="block text-sm font-semibold text-slate-800"
                  >
                    Question Title
                  </label>

                  <span className="text-xs text-slate-400">
                    {title.length}/{TITLE_MAX_LENGTH}
                  </span>
                </div>

                <input
                  id="title"
                  type="text"
                  value={title}
                  maxLength={TITLE_MAX_LENGTH}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="e.g. How do I solve this integration problem?"
                  required
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                />

                <p className="mt-2 text-xs text-slate-400">
                  Keep your title clear and specific.
                </p>
              </div>

              {/* Description */}
              <div>
                <div className="mb-2 flex items-center justify-between gap-4">
                  <label
                    htmlFor="description"
                    className="block text-sm font-semibold text-slate-800"
                  >
                    Describe Your Question
                  </label>

                  <span className="text-xs text-slate-400">
                    {description.length}/{DESCRIPTION_MAX_LENGTH}
                  </span>
                </div>

                <textarea
                  id="description"
                  value={description}
                  maxLength={DESCRIPTION_MAX_LENGTH}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Explain the problem, what you have tried, and where you are stuck..."
                  required
                  rows={7}
                  className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                />

                <p className="mt-2 text-xs text-slate-400">
                  The more context you provide, the easier it is for someone to
                  help.
                </p>
              </div>

              {/* Institution + Course */}
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <label
                    htmlFor="institution"
                    className="mb-2 block text-sm font-semibold text-slate-800"
                  >
                    Institution
                  </label>

                  <div className="relative">
                    <select
                      id="institution"
                      value={institution}
                      onChange={(event) => setInstitution(event.target.value)}
                      required
                      className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-4 py-3 pr-10 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                    >
                      <option value="">Select institution</option>

                      {institutions.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>

                    <ChevronDown
                      size={18}
                      className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="course"
                    className="mb-2 block text-sm font-semibold text-slate-800"
                  >
                    Course
                  </label>

                  <div className="relative">
                    <select
                      id="course"
                      value={course}
                      onChange={(event) => setCourse(event.target.value)}
                      required
                      className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-4 py-3 pr-10 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                    >
                      <option value="">Select course</option>

                      {courses.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>

                    <ChevronDown
                      size={18}
                      className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                  </div>
                </div>
              </div>

              {/* Course Code */}
              <div className="max-w-md">
                <label
                  htmlFor="courseCode"
                  className="mb-2 block text-sm font-semibold text-slate-800"
                >
                  Course Code
                  <span className="ml-1 font-normal text-slate-400">
                    (optional)
                  </span>
                </label>

                <input
                  id="courseCode"
                  type="text"
                  value={courseCode}
                  maxLength={20}
                  onChange={(event) => setCourseCode(event.target.value)}
                  placeholder="e.g. MTH 201"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm uppercase text-slate-900 outline-none transition placeholder:normal-case placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                />
              </div>

              {/* Attachment */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-800">
                  Attachment
                  <span className="ml-1 font-normal text-slate-400">
                    (optional)
                  </span>
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
                    <span>
                      Attach an image or document of the question
                    </span>
                  </button>
                ) : (
                  <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-blue-600">
                      <Paperclip size={18} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-800">
                        {selectedFile.name}
                      </p>

                      <p className="mt-0.5 text-xs text-slate-400">
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={removeFile}
                      aria-label="Remove attachment"
                      className="rounded-lg p-2 text-slate-400 transition hover:bg-white hover:text-slate-700"
                    >
                      <X size={17} />
                    </button>
                  </div>
                )}

                {fileError ? (
                  <p className="mt-2 text-xs font-medium text-red-600">
                    {fileError}
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-slate-400">
                    Supported: images, PDF, DOC, and DOCX. Maximum size: 10 MB.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Guidelines */}
          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
            <h3 className="text-sm font-semibold text-blue-900">
              Before you post
            </h3>

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
              disabled={
                isSubmitting ||
                !title.trim() ||
                !description.trim() ||
                !institution ||
                !course ||
                Boolean(fileError)
              }
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Send size={17} />

              {isSubmitting ? "Posting..." : "Post Question"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
