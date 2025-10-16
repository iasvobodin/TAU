// src/utils/portFinder.ts
import { createServer } from "net";

export async function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();

    server.once("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") {
        resolve(false);
      } else {
        resolve(false);
      }
    });

    server.once("listening", () => {
      server.close();
      resolve(true);
    });

    server.listen(port);
  });
}

export async function findAvailablePort(
  startPort: number,
  maxAttempts: number = 10
): Promise<number> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const port = startPort + attempt;
    const available = await isPortAvailable(port);

    if (available) {
      if (attempt > 0) {
        console.log(`Port ${startPort} was busy, using port ${port} instead`);
      }
      return port;
    }
  }

  throw new Error(
    `Could not find available port after ${maxAttempts} attempts (starting from ${startPort})`
  );
}
