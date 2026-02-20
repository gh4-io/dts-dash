import { DataImport } from "@/components/admin/data-import";
import { MasterDataImport } from "@/components/admin/master-data-import";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function DataImportPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Data Import</h1>
        <p className="text-sm text-muted-foreground">
          Import work packages, customers, and aircraft master data.
        </p>
      </div>

      <Tabs defaultValue="work-packages" className="w-full">
        <TabsList>
          <TabsTrigger value="work-packages">Work Packages</TabsTrigger>
          <TabsTrigger value="master-data">Master Data</TabsTrigger>
        </TabsList>

        <TabsContent value="work-packages" className="space-y-4">
          <DataImport />
        </TabsContent>

        <TabsContent value="master-data" className="space-y-4">
          <MasterDataImport />
        </TabsContent>
      </Tabs>
    </div>
  );
}
