export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-10">
      <p className="mb-8 font-display text-2xl font-semibold tracking-tight">
        TKG <span className="text-ink-mute">CRM</span>
      </p>
      <div className="rounded-2xl border border-line bg-paper-raised p-6 shadow-[0_1px_2px_rgba(28,26,23,0.04)]">
        {children}
      </div>
      <p className="mt-6 text-xs text-ink-mute">
        Authorised TKG Ventures staff only. Access is logged.
      </p>
    </main>
  );
}
