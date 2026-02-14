"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AircraftTypeMapping, AircraftType, NormalizedAircraftType } from "@/types";

const CANONICAL_TYPES: AircraftType[] = ["B777", "B767", "B747", "B757", "B737", "Unknown"];

interface MappingFormData {
  pattern: string;
  canonicalType: AircraftType;
  description: string;
  priority: number;
}

const emptyForm: MappingFormData = {
  pattern: "",
  canonicalType: "B747",
  description: "",
  priority: 50,
};

export function AircraftTypeEditor() {
  const [mappings, setMappings] = useState<AircraftTypeMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Dialogs
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editMapping, setEditMapping] = useState<AircraftTypeMapping | null>(null);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState<AircraftTypeMapping | null>(null);
  const [formData, setFormData] = useState<MappingFormData>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);

  // Test
  const [testInput, setTestInput] = useState("");
  const [testResult, setTestResult] = useState<NormalizedAircraftType | null>(null);
  const [testing, setTesting] = useState(false);

  const fetchMappings = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/aircraft-types");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setMappings(data.mappings);
    } catch (err) {
      console.error("Failed to load mappings:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMappings();
  }, [fetchMappings]);

  const handleAdd = async () => {
    setFormError(null);
    if (!formData.pattern.trim()) {
      setFormError("Pattern is required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/aircraft-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create");
      }
      setShowAddDialog(false);
      setFormData(emptyForm);
      await fetchMappings();
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async () => {
    if (!editMapping) return;
    setFormError(null);
    if (!formData.pattern.trim()) {
      setFormError("Pattern is required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/aircraft-types", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editMapping.id, ...formData }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update");
      }
      setEditMapping(null);
      setFormData(emptyForm);
      await fetchMappings();
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!showDeleteDialog) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/aircraft-types?id=${showDeleteDialog.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete");
      setShowDeleteDialog(null);
      await fetchMappings();
    } catch (err) {
      console.error("Delete failed:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/aircraft-types/reset", { method: "POST" });
      if (!res.ok) throw new Error("Failed to reset");
      setShowResetDialog(false);
      await fetchMappings();
    } catch (err) {
      console.error("Reset failed:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!testInput.trim()) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/admin/aircraft-types/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawType: testInput }),
      });
      if (!res.ok) throw new Error("Test failed");
      const result = await res.json();
      setTestResult(result);
    } catch (err) {
      console.error("Test failed:", err);
    } finally {
      setTesting(false);
    }
  };

  const openEditDialog = (mapping: AircraftTypeMapping) => {
    setFormData({
      pattern: mapping.pattern,
      canonicalType: mapping.canonicalType,
      description: mapping.description || "",
      priority: mapping.priority,
    });
    setFormError(null);
    setEditMapping(mapping);
  };

  const openAddDialog = () => {
    setFormData(emptyForm);
    setFormError(null);
    setShowAddDialog(true);
  };

  const confidenceBadge = (confidence: string) => {
    switch (confidence) {
      case "exact":
        return <Badge className="border-emerald-500 text-emerald-500" variant="outline">Exact</Badge>;
      case "pattern":
        return <Badge className="border-amber-500 text-amber-500" variant="outline">Pattern</Badge>;
      default:
        return <Badge variant="destructive">Fallback</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8 text-muted-foreground">
        <i className="fa-solid fa-spinner fa-spin" />
        Loading mappings...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Test Input */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="mb-3 text-sm font-medium">Test Type Resolution</h3>
        <div className="flex items-center gap-2">
          <Input
            value={testInput}
            onChange={(e) => setTestInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleTest()}
            placeholder="Enter raw type (e.g. 747-4R7F, B777, 737-200)"
            className="max-w-sm"
          />
          <Button onClick={handleTest} disabled={testing || !testInput.trim()} size="sm">
            {testing ? (
              <i className="fa-solid fa-spinner fa-spin" />
            ) : (
              <>
                <i className="fa-solid fa-vial mr-2" />
                Test
              </>
            )}
          </Button>
        </div>
        {testResult && (
          <div className="mt-3 flex items-center gap-3">
            <span className="text-sm text-muted-foreground">Result:</span>
            <Badge variant="secondary" className="text-sm font-mono">
              {testResult.canonical}
            </Badge>
            {confidenceBadge(testResult.confidence)}
            <span className="text-xs text-muted-foreground">
              Raw: &ldquo;{testResult.raw}&rdquo;
            </span>
          </div>
        )}
      </div>

      {/* Action bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={openAddDialog}>
            <i className="fa-solid fa-plus mr-2" />
            Add Rule
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowResetDialog(true)}>
            <i className="fa-solid fa-rotate-left mr-2" />
            Reset Defaults
          </Button>
        </div>
        <span className="text-sm text-muted-foreground">
          {mappings.length} rule{mappings.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Mappings table */}
      <div className="rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pattern</TableHead>
              <TableHead>Canonical Type</TableHead>
              <TableHead className="hidden sm:table-cell">Description</TableHead>
              <TableHead className="w-20 text-center">Priority</TableHead>
              <TableHead className="w-20 text-center">Active</TableHead>
              <TableHead className="w-24 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mappings.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  No mappings found. Click &ldquo;Add Rule&rdquo; or &ldquo;Reset Defaults&rdquo; to get started.
                </TableCell>
              </TableRow>
            ) : (
              mappings.map((mapping) => (
                <TableRow key={mapping.id}>
                  <TableCell className="font-mono text-sm">{mapping.pattern}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{mapping.canonicalType}</Badge>
                  </TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">
                    {mapping.description || "—"}
                  </TableCell>
                  <TableCell className="text-center text-sm">{mapping.priority}</TableCell>
                  <TableCell className="text-center">
                    {mapping.isActive ? (
                      <i className="fa-solid fa-circle-check text-emerald-500" />
                    ) : (
                      <i className="fa-solid fa-circle-xmark text-muted-foreground" />
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => openEditDialog(mapping)}
                      >
                        <i className="fa-solid fa-pen-to-square text-xs" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                        onClick={() => setShowDeleteDialog(mapping)}
                      >
                        <i className="fa-solid fa-trash text-xs" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add Rule dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Rule</DialogTitle>
          </DialogHeader>
          <MappingForm
            formData={formData}
            setFormData={setFormData}
            error={formError}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={saving}>
              {saving ? <i className="fa-solid fa-spinner fa-spin mr-2" /> : <i className="fa-solid fa-plus mr-2" />}
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Rule dialog */}
      <Dialog open={!!editMapping} onOpenChange={(open) => !open && setEditMapping(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Rule</DialogTitle>
          </DialogHeader>
          <MappingForm
            formData={formData}
            setFormData={setFormData}
            error={formError}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditMapping(null)}>Cancel</Button>
            <Button onClick={handleEdit} disabled={saving}>
              {saving ? <i className="fa-solid fa-spinner fa-spin mr-2" /> : <i className="fa-solid fa-floppy-disk mr-2" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog open={!!showDeleteDialog} onOpenChange={(open) => !open && setShowDeleteDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Rule?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Delete the mapping rule for pattern{" "}
            <code className="font-mono text-foreground">{showDeleteDialog?.pattern}</code>?
            This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={saving}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset defaults dialog */}
      <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset to Defaults?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will delete <strong>all</strong> current rules and restore the 10 default
            mapping rules. Custom rules will be lost.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowResetDialog(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleReset} disabled={saving}>
              Reset Defaults
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MappingForm({
  formData,
  setFormData,
  error,
}: {
  formData: MappingFormData;
  setFormData: (data: MappingFormData) => void;
  error: string | null;
}) {
  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}
      <div className="space-y-2">
        <Label>Pattern</Label>
        <Input
          value={formData.pattern}
          onChange={(e) => setFormData({ ...formData, pattern: e.target.value })}
          placeholder="e.g. ^B747$ or 747 or C-F*"
          className="font-mono"
        />
        <p className="text-xs text-muted-foreground">
          Supports regex anchors (^$) and wildcards (* for any chars, ? for single char)
        </p>
      </div>
      <div className="space-y-2">
        <Label>Canonical Type</Label>
        <Select
          value={formData.canonicalType}
          onValueChange={(v) => setFormData({ ...formData, canonicalType: v as AircraftType })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CANONICAL_TYPES.map((t) => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Description</Label>
        <Input
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="e.g. Matches all 747 variants"
        />
      </div>
      <div className="space-y-2">
        <Label>Priority</Label>
        <Input
          type="number"
          value={formData.priority}
          onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })}
          min={0}
          max={1000}
        />
        <p className="text-xs text-muted-foreground">
          Higher priority rules are checked first (100 = exact, 50 = pattern)
        </p>
      </div>
    </div>
  );
}
