"""กันไฟล์ .js เก่า (เช่น ที่เผลอคอมไพล์ทิ้งไว้) มาบังไฟล์ .ts/.tsx ชื่อเดียวกัน

Next.js (webpack) หาไฟล์ตามลำดับนามสกุล โดย .js มาก่อน .ts/.tsx จึงจะโหลดไฟล์ .js เก่าแทนโค้ดใหม่แบบเงียบ ๆ
(เคยทำให้ฟีเจอร์วาดภาพไม่แสดงบนเว็บจริง ทั้งที่ typecheck/CI ผ่านหมด)
"""

import pathlib
import unittest

FRONTEND = pathlib.Path(__file__).resolve().parents[2] / "frontend"
SOURCE_DIRS = ("app", "components", "lib")


class FrontendLayoutTests(unittest.TestCase):
    def test_no_stale_js_next_to_typescript_sources(self):
        shadows = []
        for folder in SOURCE_DIRS:
            for ts_file in (FRONTEND / folder).rglob("*.ts*"):
                if ts_file.suffix not in (".ts", ".tsx"):
                    continue
                for js_suffix in (".js", ".jsx", ".mjs"):
                    twin = ts_file.with_suffix(js_suffix)
                    if twin.exists():
                        shadows.append(str(twin.relative_to(FRONTEND)))
        self.assertEqual(shadows, [], "ลบไฟล์เหล่านี้ทิ้ง: มันบังไฟล์ TypeScript ชื่อเดียวกัน")


if __name__ == "__main__":
    unittest.main()
