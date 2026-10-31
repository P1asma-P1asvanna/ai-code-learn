import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner small muted">
        <span>AI Code Learn · เรียนเขียนโค้ดฟรี</span>
        <span className="spacer" />
        <Link href="/lessons">บทเรียน</Link>
        <Link href="/playground">Playground</Link>
        <Link href="/about">เกี่ยวกับเว็บนี้และความเป็นส่วนตัว</Link>
      </div>
    </footer>
  );
}
