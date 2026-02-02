"use client";

import { signIn, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, Suspense } from "react";
import { Button } from "@/components/ui/button";

function LoginContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  useEffect(() => {
    if (session) {
      router.push("/");
    }
  }, [session, router]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="glass-heavy glass-elevated rounded-3xl p-10 max-w-md w-full mx-4 animate-slide-up">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-violet-500 via-purple-500 to-rose-400 flex items-center justify-center text-white text-2xl font-bold mx-auto mb-4 shadow-glow">
            HD
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            High Desert Property Management
          </h1>
          <p className="text-gray-500 mt-2">
            Oregon Landlord-Tenant Law Assistant
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50/80 backdrop-blur-sm border border-red-200/50 rounded-2xl text-red-700 text-sm">
            {error === "AccessDenied" ? (
              <>
                <strong>Access Denied:</strong> Only @highdesertpm.com email
                addresses are allowed. Please sign in with your company Microsoft
                account.
              </>
            ) : (
              <>
                <strong>Error:</strong> There was a problem signing in. Please
                try again.
              </>
            )}
          </div>
        )}

        {/* Sign In Button */}
        <Button
          onClick={() => signIn("azure-ad", { callbackUrl: "/" })}
          className="w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 h-12 text-base font-medium shadow-glow hover:shadow-glow-lg transition-all duration-300 rounded-xl"
        >
          <svg
            className="w-5 h-5 mr-2"
            viewBox="0 0 21 21"
            fill="currentColor"
          >
            <path d="M0 0h10v10H0V0zm11 0h10v10H11V0zM0 11h10v10H0V11zm11 0h10v10H11V11z" />
          </svg>
          Sign in with Microsoft
        </Button>

        {/* Footer */}
        <p className="text-center text-sm text-gray-500 mt-6">
          Use your @highdesertpm.com Microsoft account to sign in.
        </p>
        <p className="text-center text-xs text-gray-400 mt-4">
          Internal Use Only
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-500">Loading...</p>
          </div>
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
