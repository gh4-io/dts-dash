"use client";

import React from "react";

interface Step {
  label: string;
  icon?: string;
}

interface ImportStepperProps {
  currentStep: number;
  steps: Step[];
}

export function ImportStepper({ currentStep, steps }: ImportStepperProps) {
  return (
    <nav aria-label="Import progress" className="w-full">
      <ol className="flex items-center">
        {steps.map((step, index) => {
          const stepNumber = index + 1;
          const isCompleted = stepNumber < currentStep;
          const isCurrent = stepNumber === currentStep;
          const isLast = index === steps.length - 1;

          return (
            <li key={stepNumber} className={`flex items-center ${isLast ? "" : "flex-1"}`}>
              {/* Step circle + label */}
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={`
                    flex h-8 w-8 shrink-0 items-center justify-center rounded-full
                    border-2 text-sm font-semibold transition-colors
                    ${
                      isCompleted
                        ? "border-emerald-500 bg-emerald-500 text-white"
                        : isCurrent
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background text-muted-foreground"
                    }
                  `}
                  aria-current={isCurrent ? "step" : undefined}
                >
                  {isCompleted ? (
                    <i className="fa-solid fa-check text-xs" />
                  ) : step.icon ? (
                    <i className={`${step.icon} text-xs`} />
                  ) : (
                    stepNumber
                  )}
                </div>

                {/* Label — hidden on small screens */}
                <span
                  className={`
                    hidden text-center text-xs font-medium sm:block
                    ${
                      isCompleted
                        ? "text-emerald-500"
                        : isCurrent
                          ? "text-primary"
                          : "text-muted-foreground"
                    }
                  `}
                >
                  {step.label}
                </span>

                {/* Step number label — visible only on small screens */}
                <span
                  className={`
                    block text-center text-[10px] font-medium sm:hidden
                    ${
                      isCompleted
                        ? "text-emerald-500"
                        : isCurrent
                          ? "text-primary"
                          : "text-muted-foreground"
                    }
                  `}
                >
                  {stepNumber}/{steps.length}
                </span>
              </div>

              {/* Connecting line */}
              {!isLast && (
                <div
                  className={`
                    mx-2 h-0.5 flex-1 transition-colors
                    ${isCompleted ? "bg-emerald-500" : "bg-border"}
                  `}
                  aria-hidden="true"
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
