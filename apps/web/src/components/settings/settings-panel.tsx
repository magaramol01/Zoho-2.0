import { Button, Kbd, Surface } from "@zoho-power-grid/ui";
import type { BootstrapPayload } from "@zoho-power-grid/shared";

export const SettingsPanel = ({ bootstrap }: { bootstrap: BootstrapPayload }) => (
  <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_360px]">
    <Surface title="Zoho connection" subtitle="Use secure OAuth through the local NestJS BFF.">
      <div className="space-y-4">
        <div className="rounded-3xl bg-slate-50 p-4">
          <p className="font-medium text-slate-900">
            {bootstrap.authenticated ? "Connected" : "Not connected"}
          </p>
          <p className="mt-2 text-sm text-slate-500">
            {bootstrap.authenticated
              ? `Signed in as ${bootstrap.currentUser?.displayName ?? "your Zoho user"}.`
              : "Add Zoho OAuth credentials in apps/api/.env, then connect your account."}
          </p>
        </div>
        {bootstrap.authUrl ? (
          <a href={bootstrap.authUrl}>
            <Button>Connect Zoho Sprints</Button>
          </a>
        ) : null}
        <div className="rounded-3xl bg-sky-50 p-4 text-sm text-sky-900">
          Tokens stay on the server, are encrypted at rest, and never touch browser storage.
        </div>
      </div>
    </Surface>

    <Surface title="Keyboard map" subtitle="Designed for low-friction daily use.">
      <div className="space-y-3">
        {bootstrap.shortcuts.map((shortcut) => (
          <div key={shortcut.combo} className="flex items-center justify-between gap-4 rounded-2xl bg-slate-50 px-4 py-3">
            <span className="text-sm text-slate-700">{shortcut.description}</span>
            <Kbd>{shortcut.combo}</Kbd>
          </div>
        ))}
      </div>
    </Surface>
  </div>
);
