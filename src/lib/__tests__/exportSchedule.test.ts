import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { rowsToCsv, downloadScheduleCsv } from "@/lib/exportSchedule";

describe("exportSchedule", () => {
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;

  beforeEach(() => {
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:mock"),
      revokeObjectURL: vi.fn(),
    } as unknown as typeof URL);
    vi.spyOn(document.body, "appendChild");
    vi.spyOn(document.body, "removeChild");
    vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
      const el = document.createElementNS("http://www.w3.org/1999/xhtml", tagName);
      if (tagName === "a") (el as HTMLAnchorElement).click = vi.fn();
      return el as HTMLAnchorElement;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("builds CSV with correct headers and delimiters", () => {
    const rows = [
      {
        scheduled_at: "2026-07-06T10:00:00Z",
        platform: "LinkedIn",
        copy_text: "Hello world",
        workflow_status: "scheduled",
        post_snapshot: { title: "Post 1", topic: "Growth", hashtags: "#AI #Growth" },
        utm_link: "",
        calendar_title: "My Calendar",
      },
    ];
    const csv = rowsToCsv(rows, "UTC");
    expect(csv).toContain("Date");
    expect(csv).toContain("Time");
    expect(csv).toContain("Timezone");
    expect(csv).toContain("Platform");
    expect(csv).toContain("Status");
    expect(csv).toContain("Calendar");
    expect(csv).toContain("Title");
    expect(csv).toContain("Caption");
    expect(csv).toContain("Hashtags");
    expect(csv).toContain("UTM link");
    expect(csv).toContain("My Calendar");
    expect(csv).toContain("Post 1");
    expect(csv).toContain("Hello world");
  });

  it("escapes commas, quotes, and newlines per RFC 4180", () => {
    const rows = [
      {
        scheduled_at: "2026-07-06T10:00:00Z",
        platform: "LinkedIn, Inc",
        copy_text: 'Say "hello"\nnew line',
        workflow_status: "scheduled",
        post_snapshot: { title: 'A "quoted" title', topic: "", hashtags: "" },
        utm_link: "",
        calendar_title: "Cal",
      },
    ];
    const csv = rowsToCsv(rows, "UTC");
    expect(csv).toContain('"LinkedIn, Inc"');
    expect(csv).toContain('"Say ""hello""\nnew line"');
    expect(csv).toContain('"A ""quoted"" title"');
  });

  it("returns empty data rows but preserves headers when given empty input", () => {
    const csv = rowsToCsv([], "UTC");
    const lines = csv.split("\r\n");
    expect(lines.length).toBe(1);
    expect(lines[0]).toBe(
      "Date,Time,Timezone,Platform,Status,Calendar,Title,Caption,Hashtags,UTM link"
    );
  });

  it("downloadScheduleCsv triggers a browser download", async () => {
    downloadScheduleCsv([], "UTC", "test-schedule.csv");
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(document.body.appendChild).toHaveBeenCalled();
  });
});
