import type { Metadata } from "next";
import LoginForm from "@/components/login-form";

export const metadata: Metadata = {
  title: "Sign in · Cello Buddy",
};

export default function LoginPage() {
  return (
    <main className="flex flex-1 flex-col">
      <section className="mx-auto w-full max-w-sm px-6 pt-16 pb-20 sm:pt-28">
        <h1 className="text-3xl font-semibold leading-[1.1] tracking-tight sm:text-4xl">
          Cello Buddy
        </h1>
        <p className="mt-4 text-base leading-relaxed text-muted">
          Sign in to load a score and start practicing.
        </p>

        <div className="mt-10">
          <LoginForm />
        </div>
      </section>
    </main>
  );
}
