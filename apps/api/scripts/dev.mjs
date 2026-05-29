import { spawn } from "node:child_process";

const isWindows = process.platform === "win32";
const pnpmCommand = isWindows ? "pnpm.cmd" : "pnpm";
const children = new Set();
let shuttingDown = false;

const spawnProcess = (command, args) => {
  const child = spawn(command, args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
  });

  children.add(child);
  child.on("exit", () => {
    children.delete(child);
  });

  return child;
};

const stopChildren = (signal = "SIGTERM") => {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) {
      child.kill(signal);
    }
  }
};

const exitWithFailure = (message, code = 1) => {
  console.error(message);
  stopChildren();
  process.exit(code);
};

const scheduleExit = (code = 0) => {
  const timer = setTimeout(() => {
    process.exit(code);
  }, 1000);

  timer.unref();
};

const runInitialBuild = () =>
  new Promise((resolve, reject) => {
    const build = spawnProcess(pnpmCommand, ["exec", "tsc", "-p", "tsconfig.json"]);

    build.on("error", reject);
    build.on("exit", (code, signal) => {
      if (signal) {
        reject(new Error(`Initial build stopped with signal ${signal}`));
        return;
      }

      if (code !== 0) {
        reject(new Error(`Initial build failed with exit code ${code ?? 1}`));
        return;
      }

      resolve();
    });
  });

const wireChildExit = (child, label) => {
  child.on("error", (error) => {
    exitWithFailure(`${label} failed to start: ${error.message}`);
  });

  child.on("exit", (code, signal) => {
    if (shuttingDown) {
      return;
    }

    if (signal) {
      exitWithFailure(`${label} stopped with signal ${signal}`);
      return;
    }

    exitWithFailure(`${label} exited with code ${code ?? 1}`, code ?? 1);
  });
};

process.on("SIGINT", () => {
  stopChildren("SIGINT");
  scheduleExit(0);
});

process.on("SIGTERM", () => {
  stopChildren("SIGTERM");
  scheduleExit(0);
});

try {
  await runInitialBuild();
} catch (error) {
  const message = error instanceof Error ? error.message : "Initial build failed";
  exitWithFailure(message);
}

const compiler = spawnProcess(pnpmCommand, [
  "exec",
  "tsc",
  "-p",
  "tsconfig.json",
  "--watch",
  "--preserveWatchOutput",
]);

const server = spawnProcess(process.execPath, [
  "--watch",
  "--watch-preserve-output",
  "--env-file=.env",
  "dist/apps/api/src/main.js",
]);

wireChildExit(compiler, "TypeScript watcher");
wireChildExit(server, "API server");
