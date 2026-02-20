import pino from "pino";
import { getLogLevel } from "@/lib/config/loader";

const isDev = process.env.NODE_ENV !== "production";

export const logger = pino({
  level: getLogLevel(),
  ...(isDev
    ? {
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "HH:MM:ss",
            ignore: "pid,hostname",
          },
        },
      }
    : {}),
});

export function createChildLogger(name: string) {
  return logger.child({ module: name });
}
