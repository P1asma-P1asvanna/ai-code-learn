"""ตัวรัน SQL สำหรับ AI Code Learn — ใช้ sqlite3 ที่มากับ Python (ในเบราว์เซอร์คือ Pyodide)

ทุกครั้งที่รัน จะสร้างฐานข้อมูลในหน่วยความจำใหม่ ใส่ตารางตัวอย่าง (pets, snacks, owners) ให้ แล้วรันคำสั่ง SQL ของผู้เรียนทีละคำสั่ง
คำสั่งที่ได้ตาราง (เช่น SELECT) จะถูกพิมพ์เป็นข้อความ: บรรทัดแรกเป็นชื่อคอลัมน์ ตามด้วยแถวข้อมูล คั่นช่องด้วย " | "
ไฟล์นี้ใช้เฉพาะ standard library และมีเทสต์ใน backend/tests (รันด้วย Python ปกติ)
"""

import sqlite3 as _sqlite3

MAX_ROWS = 200

SEED = """
CREATE TABLE pets (id INTEGER PRIMARY KEY, name TEXT, kind TEXT, age INTEGER, weight REAL);
INSERT INTO pets VALUES (1, 'มะลิ', 'แมว', 3, 4.2);
INSERT INTO pets VALUES (2, 'ถั่วดำ', 'หมา', 5, 12.5);
INSERT INTO pets VALUES (3, 'โมจิ', 'แมว', 1, 2.8);
INSERT INTO pets VALUES (4, 'ข้าวปั้น', 'กระต่าย', 2, 1.9);
INSERT INTO pets VALUES (5, 'ทองดี', 'หมา', 8, 20.1);
INSERT INTO pets VALUES (6, 'ส้มโอ', 'หนู', 1, 0.1);
INSERT INTO pets VALUES (7, 'บุ๋ม', 'แมว', 6, 5.0);
INSERT INTO pets VALUES (8, 'ตะวัน', 'นก', 2, 0.3);

CREATE TABLE snacks (id INTEGER PRIMARY KEY, name TEXT, price INTEGER, stock INTEGER);
INSERT INTO snacks VALUES (1, 'คุกกี้', 15, 20);
INSERT INTO snacks VALUES (2, 'ช็อกโกแลต', 25, 10);
INSERT INTO snacks VALUES (3, 'ลูกอม', 5, 100);
INSERT INTO snacks VALUES (4, 'น้ำส้ม', 12, 30);
INSERT INTO snacks VALUES (5, 'ขนมปัง', 18, 0);

CREATE TABLE owners (id INTEGER PRIMARY KEY, name TEXT, pet_id INTEGER);
INSERT INTO owners VALUES (1, 'คุณสมชาย', 1);
INSERT INTO owners VALUES (2, 'คุณสมหญิง', 2);
INSERT INTO owners VALUES (3, 'คุณมานะ', 5);
INSERT INTO owners VALUES (4, 'คุณปิติ', 3);
"""

_DENIED = {_sqlite3.SQLITE_ATTACH, _sqlite3.SQLITE_DETACH}


def _authorizer(action, *_):
    # ไม่ให้เปิด/ผูกไฟล์ฐานข้อมูลอื่น
    return _sqlite3.SQLITE_DENY if action in _DENIED else _sqlite3.SQLITE_OK


def _cell(value):
    if value is None:
        return "NULL"
    if isinstance(value, float):
        return repr(round(value, 6)) if value != int(value) else repr(value)
    return str(value)


def _split(source):
    """แยกเป็นคำสั่ง (จบด้วย ;) โดยใช้ sqlite3.complete_statement ที่เข้าใจเครื่องหมายคำพูดและคอมเมนต์"""
    buffer = ""
    for line in source.splitlines(True):
        if not buffer.strip() and line.strip().startswith("--"):
            continue
        for ch in line:
            buffer += ch
            if ch == ";" and _sqlite3.complete_statement(buffer):
                yield buffer.strip()
                buffer = ""
    if buffer.strip() and not all(l.strip().startswith("--") or not l.strip() for l in buffer.splitlines()):
        yield buffer.strip()  # คำสั่งสุดท้ายที่ลืมใส่ ;


def run_sql(source, emit):
    """รัน SQL ทั้งก้อน: ส่งบรรทัดผลลัพธ์ให้ emit(text) คืน None ถ้าสำเร็จ หรือข้อความ error (ภาษาไทย)"""
    conn = _sqlite3.connect(":memory:")
    try:
        conn.executescript(SEED)
        conn.set_authorizer(_authorizer)
        for statement in _split(source):
            try:
                cursor = conn.execute(statement)
                if cursor.description:
                    emit(" | ".join(col[0] for col in cursor.description))
                    count = 0
                    for row in cursor:
                        count += 1
                        if count > MAX_ROWS:
                            emit("… (แสดงเฉพาะ %d แถวแรก)" % MAX_ROWS)
                            break
                        emit(" | ".join(_cell(v) for v in row))
                    if count == 0:
                        emit("(ไม่มีแถวที่ตรงเงื่อนไข)")
            except _sqlite3.Warning:
                return "รันได้ทีละ 1 คำสั่ง: ใส่ ; จบแต่ละคำสั่ง"
            except _sqlite3.Error as error:
                return "SQL ผิดพลาด: %s\nตรงคำสั่ง: %s" % (error, statement[:120])
        return None
    finally:
        conn.close()
