export default function DashboardPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">
        <i className="fa-solid fa-chart-line mr-2" />
        Statistics Dashboard
      </h1>
      <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
        <i className="fa-solid fa-chart-pie text-4xl mb-4 block" />
        <p className="text-lg font-medium">Coming in M3</p>
        <p className="text-sm">KPI cards, charts, and operator performance analytics.</p>
      </div>
    </div>
  );
}
