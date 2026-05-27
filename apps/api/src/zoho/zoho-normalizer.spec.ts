import { describe, expect, it } from "vitest";
import { ZohoNormalizer } from "./zoho-normalizer";
import { toZohoLogDateTime, toZohoLogDuration } from "./zoho-timesheet";

describe("ZohoNormalizer", () => {
  const normalizer = new ZohoNormalizer();

  it("normalizes task-like payloads into TaskRow objects", () => {
    const result = normalizer.normalizeTasks({
      data: [
        {
          itemid: "123",
          itemno: "PG-1",
          name: "Inline edit task",
          projectid: "p1",
          projectname: "Power Grid",
          sprintid: "s1",
          sprintname: "Sprint 1",
          statusid: "st1",
          statusname: "In Progress",
          priorityid: "pr1",
          priorityname: "High",
          users: [{ userid: "u1", zsname: "Ari" }],
          tags: [{ tagid: "t1", name: "grid" }],
          duration: "120",
          loghours: "45",
          remaininghours: "75",
        },
      ],
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "123",
      itemNo: "PG-1",
      projectId: "p1",
      sprintId: "s1",
      statusName: "In Progress",
      priorityName: "High",
      assigneeNames: ["Ari"],
      tagNames: ["grid"],
      estimatedMinutes: 120,
      loggedMinutes: 45,
      remainingMinutes: 75,
    });
  });

  it("normalizes nested status objects that expose statusname", () => {
    const result = normalizer.normalizeTasks({
      data: [
        {
          itemid: "456",
          itemno: "PG-2",
          name: "Nested status task",
          projectid: "p2",
          status: {
            id: "st2",
            statusname: "In progress",
          },
          users: [],
          tags: [],
        },
      ],
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "456",
      statusId: "st2",
      statusName: "In progress",
    });
  });

  it("normalizes Zoho billable flags from 0 and 1 values", () => {
    const result = normalizer.normalizeTimesheetLogs({
      data: [
        {
          id: "log-1",
          itemid: "task-1",
          projectid: "project-1",
          date: "2026-05-27",
          duration: "30",
          isbillable: "0",
        },
        {
          id: "log-2",
          itemid: "task-1",
          projectid: "project-1",
          date: "2026-05-27",
          duration: "45",
          isbillable: "1",
        },
      ],
    });

    expect(result).toHaveLength(2);
    expect(result[0]?.billable).toBe(false);
    expect(result[1]?.billable).toBe(true);
  });

  it("formats log dates for Zoho timesheet write APIs", () => {
    expect(toZohoLogDateTime("2026-05-27")).toMatch(
      /^2026-05-27T00:00:00[+-]\d{4}$/,
    );
  });

  it("formats log duration for Zoho timesheet write APIs", () => {
    expect(toZohoLogDuration(30)).toBe("00:30");
    expect(toZohoLogDuration(452)).toBe("07:32");
  });
});
