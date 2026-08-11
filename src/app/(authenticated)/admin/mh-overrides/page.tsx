import { MHOverridesPanel } from "@/components/admin/mh-overrides-panel";

export default function MHOverridesPage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">MH Overrides</h2>
        <p className="text-sm text-muted-foreground">
          Manual man-hour overrides sit at the top of the effectiveMH chain (override &gt; WP MH
          &gt; contract &gt; default). Clearing one restores the chain. Bulk changes go through the
          Data Hub &rarr; MH Overrides schema.
        </p>
      </div>

      <MHOverridesPanel />
    </div>
  );
}
