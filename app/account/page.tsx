import type { Metadata } from "next";
import Link from "next/link";
import AccountDetails from "@/components/account-details";
import { buttonClass } from "@/components/button";
import ChangePasswordForm from "@/components/change-password-form";
import PanelSection from "@/components/panel-section";
import SignOutButton from "@/components/sign-out-button";

export const metadata: Metadata = {
  title: "Account · Cello Buddy",
};

export default function AccountPage() {
  return (
    <main className="flex flex-1 flex-col">
      <header className="flex h-12 shrink-0 items-center justify-between px-4">
        <Link href="/" className={buttonClass("ghost", "-ml-2")}>
          ← Home
        </Link>
        <SignOutButton />
      </header>
      <section className="mx-auto w-full max-w-xl px-6 pt-4 pb-20 sm:pt-12">
        <h1 className="text-3xl font-semibold leading-[1.1] tracking-tight sm:text-4xl">Account</h1>
        <p className="mt-4 text-base leading-relaxed text-muted">
          Your buddy keeps the numbers. You keep the password.
        </p>

        <div className="mt-10 flex flex-col gap-10">
          <PanelSection eyebrow="Account" title="Details">
            <AccountDetails />
          </PanelSection>

          <PanelSection eyebrow="Security" title="Change password">
            <ChangePasswordForm />
          </PanelSection>
        </div>
      </section>
    </main>
  );
}
