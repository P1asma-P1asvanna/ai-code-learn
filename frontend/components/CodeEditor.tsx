"use client";

import Editor, { type OnMount } from "@monaco-editor/react";
import { useEffect, useRef, useState } from "react";

type Props = {
  /** ชื่อไฟล์สมมติ ใช้แยกโมเดลของแต่ละแท็บ (ไม่ให้ประวัติ undo ปนกัน) */
  path: string;
  language: "python" | "javascript" | "html";
  value: string;
  onChange: (value: string) => void;
  onRun?: () => void;
  height?: number;
};

export default function CodeEditor({ path, language, value, onChange, onRun, height = 300 }: Props) {
  const [dark, setDark] = useState(false);
  const runRef = useRef<() => void>(() => {});

  useEffect(() => {
    runRef.current = onRun ?? (() => {});
  }, [onRun]);

  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    setDark(query.matches);
    const onThemeChange = (event: MediaQueryListEvent) => setDark(event.matches);
    query.addEventListener("change", onThemeChange);
    return () => query.removeEventListener("change", onThemeChange);
  }, []);

  const handleMount: OnMount = (editor, monaco) => {
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => runRef.current());
  };

  return (
    <div className="editor-frame" style={{ height }}>
      <Editor
        height="100%"
        path={path}
        language={language}
        value={value}
        theme={dark ? "vs-dark" : "light"}
        onChange={(next: string | undefined) => onChange(next ?? "")}
        onMount={handleMount}
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          tabSize: language === "python" ? 4 : 2,
          wordWrap: "on",
          scrollBeyondLastLine: false,
          automaticLayout: true,
        }}
      />
    </div>
  );
}
