export default function FlightBoardPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">
        <i className="fa-solid fa-plane-departure mr-2" />
        Flight Board
      </h1>
      <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
        <i className="fa-solid fa-timeline text-4xl mb-4 block" />
        <p className="text-lg font-medium">Coming in M2</p>
        <p className="text-sm">ECharts Gantt timeline with aircraft on-ground windows and global filtering.</p>
      </div>
    </div>
  );
}
