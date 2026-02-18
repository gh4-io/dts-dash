"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cronToHuman } from "@/lib/utils/cron-helpers";

export interface CronJobRow {
  key: string;
  name: string;
  description: string;
  script: string;
  schedule: string;
  enabled: boolean;
  options: Record<string, unknown>;
  builtin: boolean;
  lastRunAt: string | null;
  lastRunStatus: "success" | "error" | null;
  lastRunMessage: string | null;
  runCount: number;
}

interface CronJobTableProps {
  jobs: CronJobRow[];
  onEdit: (job: CronJobRow) => void;
  onToggle: (job: CronJobRow) => void;
  onRunNow: (job: CronJobRow) => void;
  onDelete: (job: CronJobRow) => void;
  onReset: (job: CronJobRow) => void;
  runningKey: string | null;
}

function StatusDot({ job }: { job: CronJobRow }) {
  if (!job.enabled) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-muted-foreground/40" />
          </TooltipTrigger>
          <TooltipContent>Suspended</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
  if (job.lastRunStatus === "error") {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-destructive" />
          </TooltipTrigger>
          <TooltipContent>Last run failed</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
        </TooltipTrigger>
        <TooltipContent>
          {job.lastRunStatus === "success" ? "Last run succeeded" : "Active"}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function CronJobTable({
  jobs,
  onEdit,
  onToggle,
  onRunNow,
  onDelete,
  onReset,
  runningKey,
}: CronJobTableProps) {
  if (jobs.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
        <i className="fa-solid fa-clock-rotate-left text-2xl mb-2" />
        <p className="text-sm">No cron jobs configured</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10" />
            <TableHead>Name</TableHead>
            <TableHead className="hidden md:table-cell">Script</TableHead>
            <TableHead>Schedule</TableHead>
            <TableHead className="hidden sm:table-cell">Last Run</TableHead>
            <TableHead className="hidden lg:table-cell w-16 text-center">Runs</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {jobs.map((job) => (
            <TableRow key={job.key} className={!job.enabled ? "opacity-60" : undefined}>
              <TableCell>
                <StatusDot job={job} />
              </TableCell>
              <TableCell>
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{job.name}</span>
                    <Badge variant="outline" className="text-[10px] px-1 py-0">
                      {job.builtin ? "Built-in" : "Custom"}
                    </Badge>
                  </div>
                  {job.description && (
                    <span className="text-xs text-muted-foreground line-clamp-1">
                      {job.description}
                    </span>
                  )}
                </div>
              </TableCell>
              <TableCell className="hidden md:table-cell">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <span className="text-xs font-mono text-muted-foreground truncate max-w-[200px] block">
                        {job.script.split("/").slice(-2).join("/")}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>{job.script}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </TableCell>
              <TableCell>
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-mono">{job.schedule}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {cronToHuman(job.schedule)}
                  </span>
                </div>
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                {job.lastRunAt ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">{timeAgo(job.lastRunAt)}</span>
                    {job.lastRunStatus === "error" && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <Badge variant="destructive" className="text-[10px] px-1 py-0">
                              error
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">{job.lastRunMessage}</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                    {job.lastRunStatus === "success" && (
                      <Badge
                        variant="outline"
                        className="text-[10px] px-1 py-0 border-emerald-500/50 text-emerald-500"
                      >
                        ok
                      </Badge>
                    )}
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">Never</span>
                )}
              </TableCell>
              <TableCell className="hidden lg:table-cell text-center">
                <span className="text-xs text-muted-foreground">{job.runCount}</span>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => onEdit(job)}
                        >
                          <i className="fa-solid fa-pen-to-square text-xs" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Edit</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => onToggle(job)}
                        >
                          <i
                            className={`fa-solid ${job.enabled ? "fa-pause" : "fa-play"} text-xs`}
                          />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{job.enabled ? "Suspend" : "Resume"}</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          disabled={runningKey === job.key}
                          onClick={() => onRunNow(job)}
                        >
                          {runningKey === job.key ? (
                            <i className="fa-solid fa-spinner fa-spin text-xs" />
                          ) : (
                            <i className="fa-solid fa-bolt text-xs" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Run Now</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  {job.builtin ? (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => onReset(job)}
                          >
                            <i className="fa-solid fa-rotate-left text-xs" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Reset to Defaults</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                            onClick={() => onDelete(job)}
                          >
                            <i className="fa-solid fa-trash text-xs" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Delete</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
