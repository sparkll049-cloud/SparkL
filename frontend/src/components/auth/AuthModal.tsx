"use client";

import { X } from "lucide-react";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export default function AuthModal({
  isOpen,
  onClose,
  title,
  children,
}: AuthModalProps) {
  if (!isOpen) return null;

  return (
    <div
  onClick={onClose}
  className="
    fixed
    inset-0
    z-50
    flex
    items-center
    justify-center
    bg-black/60
    p-4
    backdrop-blur-md
    animate-in
    fade-in
    duration-300"
    >
      <div
  onClick={(e) => e.stopPropagation()}
  className="
    w-full
    max-w-2xl
    rounded-[32px]
    bg-white
    shadow-[0_30px_80px_rgba(0,0,0,0.18)]
    animate-in
    zoom-in-95
    slide-in-from-bottom-5
    duration-300
  "
>
        {/* Header */}

        <div className="flex items-center justify-between border-b p-6">
          <h2 className="text-2xl font-bold text-slate-900">
            {title}
          </h2>

          <button
            onClick={onClose}
            className="
              rounded-full
              p-2
              transition
              hover:bg-slate-100
            "
          >
            <X size={22} />
          </button>
        </div>

        {/* Content */}

        <div
          className="
            max-h-[80vh]
            overflow-y-auto
            p-6
            text-slate-600
            leading-8
          "
        >
          {children}
        </div>
      </div>
    </div>
  );
}