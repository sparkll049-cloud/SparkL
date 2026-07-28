import Link from "next/link";
import { ArrowRight, LogIn, UserPlus } from "lucide-react";
import AuthLayout from "@/components/auth/AuthLayout";

export default function AuthPage() {
  return (
    <AuthLayout>
      <div className="fade-up">

        {/* Header */}

        <h1 className="text-4xl font-bold text-slate-900">
          Welcome to SparkL
        </h1>

        <p className="mt-2 text-slate-500">
          Choose how you want to continue.
        </p>

        {/* Login Card */}

        <Link href="/auth/login">
          <div
            className="
              group
              mt-10
              flex
              cursor-pointer
              items-center
              rounded-2xl
              border
              border-slate-200
              bg-white
              p-5
              transition-all
              duration-300
              hover:-translate-y-1
              hover:border-blue-500
              hover:shadow-xl
            "
          >
            <div
              className="
                flex
                h-16
                w-16
                items-center
                justify-center
                rounded-2xl
                bg-blue-100
                text-blue-600
              "
            >
              <LogIn size={30} />
            </div>

            <div className="ml-5 flex-1">
              <h3 className="text-lg font-semibold text-slate-900">
                Log in to your account
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                Welcome back. Continue your learning journey.
              </p>
            </div>

            <ArrowRight
              className="
                text-blue-600
                transition-transform
                duration-300
                group-hover:translate-x-2
              "
            />
          </div>
        </Link>

        {/* Signup Card */}

        <Link href="/auth/signup">
          <div
            className="
              group
              mt-6
              flex
              cursor-pointer
              items-center
              rounded-2xl
              border
              border-slate-200
              bg-white
              p-5
              transition-all
              duration-300
              hover:-translate-y-1
              hover:border-green-500
              hover:shadow-xl
            "
          >
            <div
              className="
                flex
                h-16
                w-16
                items-center
                justify-center
                rounded-2xl
                bg-green-100
                text-green-600
              "
            >
              <UserPlus size={30} />
            </div>

            <div className="ml-5 flex-1">
              <h3 className="text-lg font-semibold text-slate-900">
                Create a new account
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                Join SparkL and start your learning experience.
              </p>
            </div>

            <ArrowRight
              className="
                text-blue-600
                transition-transform
                duration-300
                group-hover:translate-x-2
              "
            />
          </div>
        </Link>

        {/* Footer */}

        <p className="mt-10 text-center text-sm leading-7 text-slate-500">
          By continuing, you agree to our{" "}
          <Link
            href="#"
            className="font-medium text-blue-600 hover:underline"
          >
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link
            href="#"
            className="font-medium text-blue-600 hover:underline"
          >
            Privacy Policy
          </Link>
          .
        </p>

      </div>
    </AuthLayout>
  );
}