/**
 * ตัวแปลง Markdown แบบเล็ก ๆ สำหรับเนื้อหาบทเรียน (เขียนเองเพื่อไม่ต้องพึ่งแพ็กเกจเพิ่ม)
 * รองรับ: หัวข้อ # ## ###, ย่อหน้า, รายการ - และ 1., ข้อความอ้างอิง >, โค้ดบล็อก ```, `โค้ดในบรรทัด`, **ตัวหนา**
 * ผลลัพธ์เป็นโครงสร้างข้อมูล (ไม่ใช่ HTML) ให้ React วาดเอง จึงไม่มีทางแทรกสคริปต์จากเนื้อหาได้
 */

export type Inline = { type: "text"; text: string } | { type: "code"; text: string } | { type: "bold"; text: string };

export type Block =
  | { type: "heading"; level: 1 | 2 | 3; text: string }
  | { type: "paragraph"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "quote"; text: string }
  | { type: "code"; lang: string; code: string };

const INLINE_PATTERN = /(`[^`\n]+`|\*\*[^*\n]+\*\*)/;

export function parseInline(text: string): Inline[] {
  return text
    .split(INLINE_PATTERN)
    .filter((part) => part !== "")
    .map((part): Inline => {
      if (part.length > 2 && part.startsWith("`") && part.endsWith("`")) {
        return { type: "code", text: part.slice(1, -1) };
      }
      if (part.length > 4 && part.startsWith("**") && part.endsWith("**")) {
        return { type: "bold", text: part.slice(2, -2) };
      }
      return { type: "text", text: part };
    });
}

export function parseBlocks(source: string): Block[] {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let paragraph: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      blocks.push({ type: "paragraph", text: paragraph.join(" ") });
      paragraph = [];
    }
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    const fence = /^```\s*([\w+#-]*)\s*$/.exec(line);
    if (fence) {
      flushParagraph();
      const body: string[] = [];
      i += 1;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) {
        body.push(lines[i]);
        i += 1;
      }
      i += 1; // ข้ามบรรทัดปิด ``` (ถ้าไม่มี ก็จบที่ท้ายเอกสาร)
      blocks.push({ type: "code", lang: fence[1].toLowerCase(), code: body.join("\n") });
      continue;
    }

    if (line.trim() === "") {
      flushParagraph();
      i += 1;
      continue;
    }

    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      flushParagraph();
      blocks.push({ type: "heading", level: heading[1].length as 1 | 2 | 3, text: heading[2].trim() });
      i += 1;
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      flushParagraph();
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*]\s+/, "").trim());
        i += 1;
      }
      blocks.push({ type: "ul", items });
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      flushParagraph();
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s+/, "").trim());
        i += 1;
      }
      blocks.push({ type: "ol", items });
      continue;
    }

    if (/^>\s?/.test(line)) {
      flushParagraph();
      const quoted: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        quoted.push(lines[i].replace(/^>\s?/, ""));
        i += 1;
      }
      blocks.push({ type: "quote", text: quoted.join(" ").trim() });
      continue;
    }

    paragraph.push(line.trim());
    i += 1;
  }
  flushParagraph();
  return blocks;
}
