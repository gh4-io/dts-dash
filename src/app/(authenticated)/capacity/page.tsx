export default function CapacityPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">
        <i className="fa-solid fa-gauge-high mr-2" />
        Capacity Modeling
      </h1>
      <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
        <i className="fa-solid fa-people-group text-4xl mb-4 block" />
        <p className="text-lg font-medium">Coming in M4</p>
        <p className="text-sm">Demand vs. capacity visualization with shift configuration and utilization charts.</p>
      </div>
    </div>
  );
}
