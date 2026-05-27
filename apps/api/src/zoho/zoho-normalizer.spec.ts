import { describe, expect, it } from "vitest";
import { ZohoNormalizer } from "./zoho-normalizer";

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
});
