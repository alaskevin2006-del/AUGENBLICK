import type { CourseVersionPayload } from "@znawca/datasource/payload";

// 开发资产（不删）：契约§二示例 JSON 的本地 mock。后端联调前用于跑通全流程；
// 媒体为 public/mock-media 下的真实 SVG 文件 URL（不用 data-URI：其中的 ; , 字符
// 会被 core 判分 splitAnswer 拆分，导致 fullyCorrect 永假；URL 路径形态与生产一致）。

function birdImage(name: string): string {
  return `/mock-media/${name}.svg`;
}

export const MOCK_COURSE_VERSION_ID = "birdsv2_eng@mock0001";

export const mockPayload: CourseVersionPayload = {
  schemaVersion: "0.3",
  engine: "znawca",
  courseVersionId: MOCK_COURSE_VERSION_ID,
  title: "Birds of Europe (V2 sample)",
  languageCode: "Eng",
  formatVersion: "v2",
  columns: [
    { index: 2, title: "Name / Bird", filterOnly: false, role: "both", forward: "Name", reverse: "Bird" },
    { index: 3, title: "Scientific name / Species", filterOnly: false, role: "both", forward: "Scientific name", reverse: "Species" },
    { index: 4, title: "#Family / Family", filterOnly: true, role: "both", forward: "Family", reverse: "Family" },
  ],
  items: [
    {
      id: "black-headed-gull",
      name: "Black-headed Gull",
      sourceRow: 2,
      values: {
        "Scientific name / Species": ["Chroicocephalus ridibundus"],
        "#Family / Family": ["Gulls"],
      },
      media: [{ kind: "image", url: birdImage("black-headed-gull") }],
    },
    {
      id: "common-swift",
      name: "Common Swift",
      sourceRow: 3,
      values: {
        "Scientific name / Species": ["Apus apus"],
        "#Family / Family": ["Swifts"],
      },
      media: [{ kind: "image", url: birdImage("common-swift") }],
    },
    {
      id: "white-stork",
      name: "White Stork",
      sourceRow: 4,
      values: {
        "Scientific name / Species": ["Ciconia ciconia"],
        "#Family / Family": ["Storks"],
      },
      media: [{ kind: "image", url: birdImage("white-stork") }],
    },
    {
      id: "common-kingfisher",
      name: "Common Kingfisher",
      sourceRow: 5,
      values: {
        "Scientific name / Species": ["Alcedo atthis"],
        "#Family / Family": ["Kingfishers"],
      },
      media: [{ kind: "image", url: birdImage("common-kingfisher") }],
    },
  ],
  speech: [],
  feedbackSounds: { correct: [], incorrect: [] },
};

export interface MockCourseListEntry {
  readonly courseVersionId: string;
  readonly title: string;
  readonly languageCode: string;
  readonly engine: "znawca";
  readonly itemCount: number;
}

export const mockCourseList: readonly MockCourseListEntry[] = [
  {
    courseVersionId: MOCK_COURSE_VERSION_ID,
    title: mockPayload.title,
    languageCode: "Eng",
    engine: "znawca",
    itemCount: mockPayload.items.length,
  },
];
