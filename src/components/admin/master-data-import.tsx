"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, FileText } from "lucide-react";

type DataType = "customer" | "aircraft";
type Format = "csv" | "json";
type Source = "file" | "paste";

interface ValidationResult {
  valid: boolean;
  summary: {
    total: number;
    toAdd: number;
    toUpdate: number;
    conflicts: number;
    invalidOperators?: number;
  };
  records: {
    add: unknown[];
    update: unknown[];
    fuzzyMatches?: Array<{
      registration: string;
      rawOperator: string;
      matchedCustomer: string;
      confidence: number;
    }>;
  };
  warnings: string[];
  errors: string[];
}

export function MasterDataImport() {
  const [dataType, setDataType] = useState<DataType>("customer");
  const [format, setFormat] = useState<Format>("csv");
  const [source, setSource] = useState<Source>("file");
  const [content, setContent] = useState("");
  const [fileName, setFileName] = useState("");
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      setContent(event.target?.result as string);
      setValidation(null);
    };
    reader.readAsText(file);
  };

  const handleValidate = async () => {
    if (!content) return;

    setLoading(true);
    setValidation(null);

    try {
      const endpoint =
        dataType === "customer"
          ? "/api/admin/import/customers/validate"
          : "/api/admin/import/aircraft/validate";

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, format }),
      });

      const data = await res.json();

      if (!res.ok) {
        setValidation({
          valid: false,
          summary: { total: 0, toAdd: 0, toUpdate: 0, conflicts: 0 },
          records: { add: [], update: [] },
          warnings: [],
          errors: [data.error || "Validation failed"],
        });
        return;
      }

      setValidation(data);
    } catch (error) {
      setValidation({
        valid: false,
        summary: { total: 0, toAdd: 0, toUpdate: 0, conflicts: 0 },
        records: { add: [], update: [] },
        warnings: [],
        errors: [error instanceof Error ? error.message : "Unknown error"],
      });
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!content || !validation?.valid) return;

    setImporting(true);

    try {
      const endpoint =
        dataType === "customer"
          ? "/api/admin/import/customers/commit"
          : "/api/admin/import/aircraft/commit";

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          format,
          source,
          fileName: source === "file" ? fileName : undefined,
          overrideConflicts: false,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(`Import failed: ${data.error || "Unknown error"}`);
        return;
      }

      alert(
        `Import successful!\nAdded: ${data.summary.added}\nUpdated: ${data.summary.updated}\nSkipped: ${data.summary.skipped}`
      );

      // Reset
      setContent("");
      setFileName("");
      setValidation(null);
    } catch (error) {
      alert(`Import failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <Tabs
        value={dataType}
        onValueChange={(v) => {
          setDataType(v as DataType);
          setValidation(null);
        }}
      >
        <TabsList>
          <TabsTrigger value="customer">Customers</TabsTrigger>
          <TabsTrigger value="aircraft">Aircraft</TabsTrigger>
        </TabsList>

        <TabsContent value={dataType} className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>
                Import {dataType === "customer" ? "Customers" : "Aircraft"}
              </CardTitle>
              <CardDescription>
                Upload or paste {dataType === "customer" ? "customer" : "aircraft"}{" "}
                master data in CSV or JSON format
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Format Selection */}
              <div className="flex gap-2">
                <Button
                  variant={format === "csv" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFormat("csv")}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  CSV
                </Button>
                <Button
                  variant={format === "json" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFormat("json")}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  JSON
                </Button>
              </div>

              {/* Source Selection */}
              <div className="flex gap-2">
                <Button
                  variant={source === "file" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSource("file")}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Upload File
                </Button>
                <Button
                  variant={source === "paste" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSource("paste")}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Paste Content
                </Button>
              </div>

              {/* File Upload */}
              {source === "file" && (
                <div>
                  <input
                    type="file"
                    accept={format === "csv" ? ".csv" : ".json"}
                    onChange={handleFileChange}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                  />
                  {fileName && (
                    <p className="mt-2 text-sm text-muted-foreground">
                      Selected: {fileName}
                    </p>
                  )}
                </div>
              )}

              {/* Paste Content */}
              {source === "paste" && (
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder={`Paste ${format.toUpperCase()} content here...`}
                  rows={10}
                  className="w-full p-2 border rounded-md font-mono text-sm"
                />
              )}

              {/* Action Buttons */}
              <div className="flex gap-2">
                <Button
                  onClick={handleValidate}
                  disabled={!content || loading}
                >
                  {loading ? "Validating..." : "Validate & Preview"}
                </Button>
                {validation?.valid && (
                  <Button
                    onClick={handleImport}
                    disabled={importing}
                    variant="default"
                  >
                    {importing ? "Importing..." : "Import"}
                  </Button>
                )}
              </div>

              {/* Validation Results */}
              {validation && (
                <div className="space-y-2">
                  {validation.errors.length > 0 && (
                    <div className="rounded-md border border-destructive bg-destructive/10 p-4">
                      <strong className="text-destructive">Errors:</strong>
                      <ul className="mt-2 list-disc list-inside text-sm">
                        {validation.errors.map((err, idx) => (
                          <li key={idx}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {validation.warnings.length > 0 && (
                    <div className="rounded-md border border-yellow-500 bg-yellow-500/10 p-4">
                      <strong>Warnings:</strong>
                      <ul className="mt-2 list-disc list-inside text-sm">
                        {validation.warnings.map((warn, idx) => (
                          <li key={idx}>{warn}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {validation.valid && (
                    <div className="rounded-md border border-green-500 bg-green-500/10 p-4">
                      <strong>Preview:</strong>
                      <ul className="mt-2 space-y-1 text-sm">
                        <li>✓ Total: {validation.summary.total} records</li>
                        <li>• Add: {validation.summary.toAdd} new</li>
                        <li>• Update: {validation.summary.toUpdate} existing</li>
                        {validation.summary.conflicts > 0 && (
                          <li className="text-destructive">
                            ⚠ Conflicts: {validation.summary.conflicts} (confirmed source)
                          </li>
                        )}
                        {(validation.summary.invalidOperators ?? 0) > 0 && (
                          <li className="text-yellow-600">
                            ⚠ Unknown operators: {validation.summary.invalidOperators}
                          </li>
                        )}
                      </ul>

                      {validation.records.fuzzyMatches &&
                        validation.records.fuzzyMatches.length > 0 && (
                          <div className="mt-4">
                            <strong>Fuzzy Operator Matches:</strong>
                            <ul className="mt-2 list-disc list-inside text-sm">
                              {validation.records.fuzzyMatches.map((match, idx) => (
                                <li key={idx}>
                                  {match.registration}: &quot;{match.rawOperator}&quot; →
                                  &quot;{match.matchedCustomer}&quot; ({match.confidence}% confidence)
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
