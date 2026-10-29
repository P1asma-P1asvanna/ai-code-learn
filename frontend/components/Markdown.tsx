"use client";

import type { ReactNode } from "react";

import { parseBlocks, parseInline } from "@/lib/markdown";

/** ข้อความที่มี `โค้ด` และ **ตัวหนา** ปนอยู่ (ใช้กับโจทย์แบบฝึกหัดด้วย) */
export function InlineText({ text }: { text: string }) {
  return (
    <>
      {parseInline(text).map((part, index) => {
        if (part.type === "code") return <code key={index}>{part.text}</code>;
        if (part.type === "bold") return <strong key={index}>{part.text}</strong>;
        return <span key={index}>{part.text}</span>;
      })}
    </>
  );
}

type Props = {
  source: string;
  /** ภาษาของตัวอย่างโค้ดที่ลองรันได้ (เช่น "python") — บล็อกภาษาอื่นจะไม่มีปุ่มลอง */
  runnableLang?: string;
  onTryCode?: (code: string) => void;
};

export default function Markdown({ source, runnableLang, onTryCode }: Props) {
  const blocks = parseBlocks(source);

  return (
    <div className="md">
      {blocks.map((block, index): ReactNode => {
        switch (block.type) {
          case "heading": {
            const Tag = (`h${block.level}` as "h1" | "h2" | "h3");
            return (
              <Tag key={index}>
                <InlineText text={block.text} />
              </Tag>
            );
          }
          case "paragraph":
            return (
              <p key={index}>
                <InlineText text={block.text} />
              </p>
            );
          case "ul":
            return (
              <ul key={index}>
                {block.items.map((item, i) => (
                  <li key={i}>
                    <InlineText text={item} />
                  </li>
                ))}
              </ul>
            );
          case "ol":
            return (
              <ol key={index}>
                {block.items.map((item, i) => (
                  <li key={i}>
                    <InlineText text={item} />
                  </li>
                ))}
              </ol>
            );
          case "quote":
            return (
              <blockquote key={index}>
                <InlineText text={block.text} />
              </blockquote>
            );
          case "code": {
            const canTry = Boolean(onTryCode) && block.lang !== "" && block.lang === runnableLang;
            return (
              <div key={index} className="md-code">
                <pre>
                  <code>{block.code}</code>
                </pre>
                {canTry ? (
                  <button className="btn btn-small" onClick={() => onTryCode?.(block.code + "\n")}>
                    ▶ นำไปลองในตัวแก้ไข
                  </button>
                ) : null}
              </div>
            );
          }
        }
      })}
    </div>
  );
}
