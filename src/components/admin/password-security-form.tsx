"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import type { PasswordRequirements } from "@/lib/utils/password-validation";

interface PasswordSecurityFormProps {
  requirements: PasswordRequirements;
  source: "yaml" | "default";
  onChange: (requirements: PasswordRequirements) => void;
  onReset: () => void;
}

export function PasswordSecurityForm({
  requirements,
  source,
  onChange,
  onReset,
}: PasswordSecurityFormProps) {
  const updateField = <K extends keyof PasswordRequirements>(
    field: K,
    value: PasswordRequirements[K],
  ) => {
    onChange({ ...requirements, [field]: value });
  };

  // Get entropy label based on value
  const getEntropyLabel = (value: number): string => {
    if (value === 0) return "Disabled";
    if (value < 40) return "Low";
    if (value < 70) return "Medium";
    return "High";
  };

  // Get source badge color
  const getSourceBadgeColor = () => {
    switch (source) {
      case "yaml":
        return "bg-blue-500/10 text-blue-400";
      case "env":
        return "bg-amber-500/10 text-amber-400";
      default:
        return "bg-zinc-500/10 text-zinc-400";
    }
  };

  // Get source label
  const getSourceLabel = () => {
    switch (source) {
      case "yaml":
        return "Config File";
      case "env":
        return "Environment Variable";
      default:
        return "System Default";
    }
  };

  return (
    <div className="space-y-6">
      {/* Source indicator */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Current configuration source</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-1 rounded ${getSourceBadgeColor()}`}>
            {getSourceLabel()}
          </span>
          {source !== "default" && (
            <Button size="sm" variant="outline" onClick={onReset} className="text-xs">
              <i className="fa-solid fa-rotate-left mr-1" />
              Reset to Defaults
            </Button>
          )}
        </div>
      </div>

      {/* Length Requirements */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium">Length Requirements</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Minimum Length (8-128)</Label>
            <Input
              type="number"
              min={8}
              max={128}
              value={requirements.minLength}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val) && val >= 8 && val <= 128) {
                  updateField("minLength", val);
                }
              }}
            />
            <p className="text-xs text-muted-foreground">Minimum password length</p>
          </div>

          <div className="space-y-2">
            <Label>Maximum Length (8-128)</Label>
            <Input
              type="number"
              min={8}
              max={128}
              value={requirements.maxLength}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val) && val >= 8 && val <= 128) {
                  updateField("maxLength", val);
                }
              }}
            />
            <p className="text-xs text-muted-foreground">Maximum password length</p>
          </div>
        </div>
      </div>

      {/* Character Requirements */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium">Character Requirements</h3>

        <div className="flex items-center justify-between">
          <div>
            <Label>Require Uppercase Letters (A-Z)</Label>
            <p className="text-xs text-muted-foreground">At least one uppercase letter</p>
          </div>
          <Switch
            checked={requirements.requireUppercase}
            onCheckedChange={(checked) => updateField("requireUppercase", checked)}
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label>Require Lowercase Letters (a-z)</Label>
            <p className="text-xs text-muted-foreground">At least one lowercase letter</p>
          </div>
          <Switch
            checked={requirements.requireLowercase}
            onCheckedChange={(checked) => updateField("requireLowercase", checked)}
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label>Require Digits (0-9)</Label>
            <p className="text-xs text-muted-foreground">At least one numeric digit</p>
          </div>
          <Switch
            checked={requirements.requireDigits}
            onCheckedChange={(checked) => updateField("requireDigits", checked)}
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label>Require Special Characters (!@#$...)</Label>
            <p className="text-xs text-muted-foreground">At least one special character</p>
          </div>
          <Switch
            checked={requirements.requireSpecialChars}
            onCheckedChange={(checked) => updateField("requireSpecialChars", checked)}
          />
        </div>
      </div>

      {/* Security Features */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium">Security Features</h3>

        <div className="flex items-center justify-between">
          <div>
            <Label>Prevent Common Passwords</Label>
            <p className="text-xs text-muted-foreground">Block passwords from breach database</p>
          </div>
          <Switch
            checked={requirements.preventCommon}
            onCheckedChange={(checked) => updateField("preventCommon", checked)}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Minimum Entropy Score</Label>
            <span className="text-sm font-mono text-muted-foreground">
              {requirements.minEntropy} — {getEntropyLabel(requirements.minEntropy)}
            </span>
          </div>
          <Slider
            value={[requirements.minEntropy]}
            onValueChange={([v]) => updateField("minEntropy", v)}
            min={0}
            max={100}
            step={10}
          />
          <p className="text-xs text-muted-foreground">
            0 = disabled, 30-50 = medium security, 70+ = high security
          </p>
        </div>
      </div>
    </div>
  );
}
