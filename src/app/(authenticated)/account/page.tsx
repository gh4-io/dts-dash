export default function AccountPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">
        <i className="fa-solid fa-user mr-2" />
        My Account
      </h1>
      <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
        <i className="fa-solid fa-id-card text-4xl mb-4 block" />
        <p className="text-lg font-medium">Coming in M5</p>
        <p className="text-sm">Profile, preferences (theme, notifications), and security settings.</p>
      </div>
    </div>
  );
}
