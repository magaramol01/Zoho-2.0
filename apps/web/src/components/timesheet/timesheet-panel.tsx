import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { MetadataBundle, TimesheetDraft } from "@zoho-power-grid/shared";
import { Button, GhostButton, Surface } from "@zoho-power-grid/ui";
import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { isoToday, minutesToDisplay } from "@zoho-power-grid/shared";

const blankDraft = (): TimesheetDraft => ({
  projectId: "",
  date: isoToday(),
  durationMinutes: 30,
  notes: "",
  billable: true,
});

export const TimesheetPanel = ({
  metadata,
  duplicateSignal,
}: {
  metadata: MetadataBundle;
  duplicateSignal: number;
}) => {
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<TimesheetDraft[]>([
    {
      ...blankDraft(),
      projectId: metadata.projects[0]?.id ?? "",
    },
  ]);

  const { data = [] } = useQuery({
    queryKey: ["timesheet"],
    queryFn: () => api.listTimesheet(),
  });

  const submitLogs = useMutation({
    mutationFn: () => api.bulkCreateTimesheet(drafts),
    onSuccess: () => {
      setDrafts([
        {
          ...blankDraft(),
          projectId: metadata.projects[0]?.id ?? "",
        },
      ]);
      queryClient.invalidateQueries({ queryKey: ["timesheet"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  useEffect(() => {
    if (!duplicateSignal) {
      return;
    }
    setDrafts((current) => {
      const last = current.at(-1);
      return last ? [...current, { ...last }] : current;
    });
  }, [duplicateSignal]);

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <Surface title="Rapid timesheet entry" subtitle="Stage many logs locally, then submit in one pass.">
        <div className="space-y-3">
          {drafts.map((draft, index) => (
            <div key={`${draft.projectId}-${index}`} className="grid gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-12">
              <select
                className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm md:col-span-3"
                value={draft.projectId}
                onChange={(event) =>
                  setDrafts((current) =>
                    current.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, projectId: event.target.value } : item,
                    ),
                  )
                }
              >
                {metadata.projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
              <input
                type="date"
                className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm md:col-span-2"
                value={draft.date}
                onChange={(event) =>
                  setDrafts((current) =>
                    current.map((item, itemIndex) => (itemIndex === index ? { ...item, date: event.target.value } : item)),
                  )
                }
              />
              <input
                type="number"
                min={15}
                step={15}
                className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm md:col-span-2"
                value={draft.durationMinutes}
                onChange={(event) =>
                  setDrafts((current) =>
                    current.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, durationMinutes: Number(event.target.value) } : item,
                    ),
                  )
                }
              />
              <input
                placeholder="Notes"
                className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm md:col-span-4"
                value={draft.notes ?? ""}
                onChange={(event) =>
                  setDrafts((current) =>
                    current.map((item, itemIndex) => (itemIndex === index ? { ...item, notes: event.target.value } : item)),
                  )
                }
              />
              <label className="flex items-center justify-center gap-2 text-sm text-slate-600 md:col-span-1">
                <input
                  type="checkbox"
                  checked={draft.billable}
                  onChange={(event) =>
                    setDrafts((current) =>
                      current.map((item, itemIndex) => (itemIndex === index ? { ...item, billable: event.target.checked } : item)),
                    )
                  }
                />
                Billable
              </label>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <GhostButton
            onClick={() =>
              setDrafts((current) => [
                ...current,
                {
                  ...blankDraft(),
                  projectId: current.at(-1)?.projectId ?? metadata.projects[0]?.id ?? "",
                },
              ])
            }
          >
            Add row
          </GhostButton>
          <GhostButton
            onClick={() =>
              setDrafts((current) => (current.length > 1 ? [...current, { ...current.at(-1)! }] : current))
            }
          >
            Duplicate last
          </GhostButton>
          <Button onClick={() => submitLogs.mutate()} disabled={submitLogs.isPending || !drafts.length}>
            Submit {drafts.length} logs
          </Button>
        </div>
      </Surface>

      <Surface title="Recent logs" subtitle="Fast review for the last submitted work.">
        <div className="space-y-3">
          {data.length ? (
            data.slice(0, 8).map((log) => (
              <div key={log.id} className="rounded-3xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-slate-900">{log.taskName ?? log.projectName}</p>
                  <span className="text-sm text-slate-500">{minutesToDisplay(log.durationMinutes)}</span>
                </div>
                <p className="mt-1 text-sm text-slate-500">{log.date}</p>
                <p className="mt-3 text-sm text-slate-600">{log.notes}</p>
              </div>
            ))
          ) : (
            <div className="rounded-3xl bg-slate-50 p-4 text-sm text-slate-500">No logs yet. Seed or connect Zoho to populate this.</div>
          )}
        </div>
      </Surface>
    </div>
  );
};
