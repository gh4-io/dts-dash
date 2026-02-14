export default function AdminPage() {
  const adminItems = [
    { label: "Customers", icon: "fa-solid fa-palette", milestone: "M6" },
    { label: "Aircraft Types", icon: "fa-solid fa-plane-circle-check", milestone: "M7" },
    { label: "Data Import", icon: "fa-solid fa-file-import", milestone: "M7" },
    { label: "Users", icon: "fa-solid fa-users-gear", milestone: "M6" },
    { label: "Settings", icon: "fa-solid fa-cogs", milestone: "M6" },
    { label: "Analytics", icon: "fa-solid fa-chart-bar", milestone: "M8" },
    { label: "Audit Log", icon: "fa-solid fa-clipboard-list", milestone: "vNext" },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">
        <i className="fa-solid fa-shield-halved mr-2" />
        Administration
      </h1>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {adminItems.map((item) => (
          <div key={item.label} className="rounded-lg border border-border bg-card p-6">
            <div className="flex items-center gap-3 mb-2">
              <i className={`${item.icon} text-lg text-muted-foreground`} />
              <h3 className="font-semibold">{item.label}</h3>
            </div>
            <p className="text-xs text-muted-foreground">Coming in {item.milestone}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
