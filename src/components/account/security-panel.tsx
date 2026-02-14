"use client";

import { ChangePasswordForm } from "./change-password-form";

export function SecurityPanel() {
  return (
    <div className="space-y-8">
      {/* ─── Change Password (v1 — functional) ─────────────────────── */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          <i className="fa-solid fa-key mr-2" />
          Change Password
        </h3>
        <ChangePasswordForm />
      </section>

      {/* ─── vNext stubs ────────────────────────────────────────────── */}
      <div className="space-y-4">
        {[
          {
            icon: "fa-solid fa-fingerprint",
            title: "Passkeys (WebAuthn)",
            description:
              "Register hardware security keys or biometric authenticators for passwordless login.",
          },
          {
            icon: "fa-solid fa-shield-halved",
            title: "Two-Factor Authentication (2FA)",
            description:
              "Add an authenticator app for TOTP-based two-factor authentication with backup codes.",
          },
          {
            icon: "fa-solid fa-desktop",
            title: "Active Sessions",
            description:
              "View and manage all active sessions across devices. Revoke access from unknown locations.",
          },
        ].map((stub) => (
          <div
            key={stub.title}
            className="rounded-lg border border-border bg-card p-4 opacity-60"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
                <i className={`${stub.icon} text-muted-foreground`} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-medium">{stub.title}</h4>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                    Coming Soon
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {stub.description}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
