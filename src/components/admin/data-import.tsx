"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

interface ValidationSummary {
  recordCount: number;
  customerCount: number;
  aircraftCount: number;
  dateRange: { start: string; end: string } | null;
}

interface ValidationResult {
  valid: boolean;
  summary: ValidationSummary | null;
  warnings: string[];
  errors: string[];
}

interface HistoryRow {
  id: string;
  importedAt: string;
  recordCount: number;
  source: string;
  fileName: string | null;
  status: string;
  errors: string | null;
  userDisplayName: string | null;
}

interface HistoryPagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export function DataImport() {
  // File upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);

  // Paste
  const [pasteContent, setPasteContent] = useState("");

  // Validation
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [validating, setValidating] = useState(false);
  const [activeSource, setActiveSource] = useState<"file" | "paste">("file");

  // Import
  const [importing, setImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);

  // History
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [historyPagination, setHistoryPagination] = useState<HistoryPagination | null>(null);
  const [historyPage, setHistoryPage] = useState(1);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const fetchHistory = useCallback(async (page: number) => {
    setLoadingHistory(true);
    try {
      const res = await fetch(`/api/admin/import/history?page=${page}&pageSize=10`);
      if (!res.ok) throw new Error("Failed to fetch history");
      const data = await res.json();
      setHistory(data.data);
      setHistoryPagination(data.pagination);
    } catch (err) {
      console.error("Failed to load import history:", err);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory(historyPage);
  }, [fetchHistory, historyPage]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setValidation(null);
    setImportSuccess(false);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      setFileContent(content);
    };
    reader.readAsText(file);
  };

  const handleValidate = async (content: string, source: "file" | "paste") => {
    setValidating(true);
    setValidation(null);
    setImportSuccess(false);
    setActiveSource(source);

    try {
      const res = await fetch("/api/admin/import/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonContent: content }),
      });
      const result = await res.json();
      setValidation(result);
    } catch (err) {
      setValidation({
        valid: false,
        summary: null,
        warnings: [],
        errors: ["Failed to validate: " + (err as Error).message],
      });
    } finally {
      setValidating(false);
    }
  };

  const handleImport = async () => {
    const content = activeSource === "file" ? fileContent : pasteContent;
    if (!content) return;

    setImporting(true);
    try {
      const res = await fetch("/api/admin/import/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonContent: content,
          source: activeSource,
          fileName: activeSource === "file" ? fileName : undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Import failed");
      }

      setImportSuccess(true);
      setValidation(null);
      setFileContent(null);
      setFileName(null);
      setPasteContent("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      fetchHistory(1);
      setHistoryPage(1);
    } catch (err) {
      setValidation({
        valid: false,
        summary: null,
        warnings: [],
        errors: ["Import failed: " + (err as Error).message],
      });
    } finally {
      setImporting(false);
    }
  };

  const clearForm = () => {
    setValidation(null);
    setImportSuccess(false);
    setFileContent(null);
    setFileName(null);
    setPasteContent("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  };

  return (
    <div className="space-y-6">
      {/* Import success message */}
      {importSuccess && (
        <div className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-500">
          <i className="fa-solid fa-circle-check" />
          Data imported successfully. The flight board and dashboard will reflect the new data.
        </div>
      )}

      {/* Import tabs */}
      <Tabs defaultValue="file" className="space-y-4">
        <TabsList>
          <TabsTrigger value="file">
            <i className="fa-solid fa-file-arrow-up mr-2" />
            File Upload
          </TabsTrigger>
          <TabsTrigger value="paste">
            <i className="fa-solid fa-paste mr-2" />
            Paste JSON
          </TabsTrigger>
        </TabsList>

        <TabsContent value="file">
          <div className="rounded-lg border border-border bg-card p-4 space-y-4">
            <div className="flex items-center gap-4">
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileSelect}
                className="text-sm file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90 file:cursor-pointer"
              />
              {fileName && (
                <span className="text-sm text-muted-foreground">
                  <i className="fa-solid fa-file mr-1" />
                  {fileName}
                </span>
              )}
            </div>
            {fileContent && (
              <Button
                onClick={() => handleValidate(fileContent, "file")}
                disabled={validating}
                size="sm"
              >
                {validating ? (
                  <><i className="fa-solid fa-spinner fa-spin mr-2" />Validating...</>
                ) : (
                  <><i className="fa-solid fa-magnifying-glass-chart mr-2" />Validate & Preview</>
                )}
              </Button>
            )}
          </div>
        </TabsContent>

        <TabsContent value="paste">
          <div className="rounded-lg border border-border bg-card p-4 space-y-4">
            <textarea
              value={pasteContent}
              onChange={(e) => {
                setPasteContent(e.target.value);
                setValidation(null);
                setImportSuccess(false);
              }}
              placeholder='Paste OData JSON here (e.g. { "value": [...] } or [...])'
              rows={8}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <Button
              onClick={() => handleValidate(pasteContent, "paste")}
              disabled={validating || !pasteContent.trim()}
              size="sm"
            >
              {validating ? (
                <><i className="fa-solid fa-spinner fa-spin mr-2" />Validating...</>
              ) : (
                <><i className="fa-solid fa-magnifying-glass-chart mr-2" />Validate & Preview</>
              )}
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      {/* Validation result / preview */}
      {validation && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">
              {validation.valid ? (
                <span className="text-emerald-500">
                  <i className="fa-solid fa-circle-check mr-2" />
                  Validation Passed
                </span>
              ) : (
                <span className="text-destructive">
                  <i className="fa-solid fa-circle-xmark mr-2" />
                  Validation Failed
                </span>
              )}
            </h3>
            <Button variant="ghost" size="sm" onClick={clearForm}>
              <i className="fa-solid fa-xmark mr-1" />
              Clear
            </Button>
          </div>

          {/* Summary badges */}
          {validation.summary && (
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">
                <i className="fa-solid fa-database mr-1" />
                {validation.summary.recordCount} records
              </Badge>
              <Badge variant="secondary">
                <i className="fa-solid fa-building mr-1" />
                {validation.summary.customerCount} customers
              </Badge>
              <Badge variant="secondary">
                <i className="fa-solid fa-plane mr-1" />
                {validation.summary.aircraftCount} aircraft
              </Badge>
              {validation.summary.dateRange && (
                <Badge variant="outline">
                  <i className="fa-solid fa-calendar mr-1" />
                  {formatDate(validation.summary.dateRange.start).split(",")[0]} —{" "}
                  {formatDate(validation.summary.dateRange.end).split(",")[0]}
                </Badge>
              )}
            </div>
          )}

          {/* Warnings */}
          {validation.warnings.length > 0 && (
            <div className="space-y-1">
              {validation.warnings.map((w, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-amber-500">
                  <i className="fa-solid fa-triangle-exclamation" />
                  {w}
                </div>
              ))}
            </div>
          )}

          {/* Errors */}
          {validation.errors.length > 0 && (
            <div className="space-y-1">
              {validation.errors.map((e, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-destructive">
                  <i className="fa-solid fa-circle-xmark" />
                  {e}
                </div>
              ))}
            </div>
          )}

          {/* Import button */}
          {validation.valid && (
            <Button onClick={handleImport} disabled={importing}>
              {importing ? (
                <><i className="fa-solid fa-spinner fa-spin mr-2" />Importing...</>
              ) : (
                <><i className="fa-solid fa-file-import mr-2" />Import Data</>
              )}
            </Button>
          )}
        </div>
      )}

      {/* Import History */}
      <div className="space-y-3">
        <h3 className="text-lg font-medium">Import History</h3>
        <div className="rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Source</TableHead>
                <TableHead className="text-center">Records</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>User</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingHistory ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    <i className="fa-solid fa-spinner fa-spin mr-2" />
                    Loading...
                  </TableCell>
                </TableRow>
              ) : history.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    No imports yet.
                  </TableCell>
                </TableRow>
              ) : (
                history.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="text-sm">{formatDate(row.importedAt)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {row.source === "file" ? (
                          <><i className="fa-solid fa-file mr-1" />{row.fileName || "file"}</>
                        ) : row.source === "paste" ? (
                          <><i className="fa-solid fa-paste mr-1" />paste</>
                        ) : (
                          <><i className="fa-solid fa-plug mr-1" />api</>
                        )}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center text-sm">{row.recordCount}</TableCell>
                    <TableCell>
                      <Badge
                        variant={row.status === "success" ? "outline" : "destructive"}
                        className={row.status === "success" ? "border-emerald-500 text-emerald-500" : ""}
                      >
                        {row.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {row.userDisplayName || "Unknown"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {historyPagination && historyPagination.totalPages > 1 && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Page {historyPagination.page} of {historyPagination.totalPages} ({historyPagination.total} total)
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={historyPage <= 1}
                onClick={() => setHistoryPage((p) => p - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={historyPage >= historyPagination.totalPages}
                onClick={() => setHistoryPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
