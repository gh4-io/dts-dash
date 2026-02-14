export default function SettingsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">
        <i className="fa-solid fa-gear mr-2" />
        Settings
      </h1>
      <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
        <i className="fa-solid fa-sliders text-4xl mb-4 block" />
        <p className="text-lg font-medium">Coming in M5</p>
        <p className="text-sm">Demand model, capacity model, shift configuration, and display settings.</p>
      </div>
    </div>
  );
}
