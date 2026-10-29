"""เนื้อหาบทเรียนและแบบฝึกหัด — ข้อมูลล้วน ๆ (แก้ไฟล์นี้แล้ว push ระบบจะซิงก์เข้าฐานข้อมูลให้ตอนเริ่มระบบ)

กติกาการซิงก์ (ดู seed.py):
- ภาษา/คอร์ส/บทเรียน จับคู่ด้วย slug  → เปลี่ยนชื่อ slug = สร้างใหม่ (ความคืบหน้าของบทเดิมไม่ย้ายตาม)
- แบบฝึกหัดจับคู่ด้วย "ลำดับในบทเรียน" → อย่าสลับลำดับข้อ ถ้าเพิ่มข้อใหม่ให้ต่อท้าย
  (คะแนนที่ผู้เรียนทำไว้ผูกกับแต่ละข้อ)

แบบฝึกหัดเขียนโค้ด (code): แต่ละ case คือการรันหนึ่งครั้ง
  before   โค้ดที่ระบบใส่ไว้ "ก่อน" โค้ดผู้เรียน (เช่น กำหนดค่าตัวแปรให้ต่างกันแต่ละรอบ)
  after    โค้ดที่ระบบต่อท้าย "หลัง" โค้ดผู้เรียน (เช่น เรียกฟังก์ชันที่ผู้เรียนเขียน)
  expected ผลลัพธ์ที่ต้องแสดงออกหน้าจอ (ไม่ส่งไปให้ frontend)
"""

from __future__ import annotations

from typing import Any

LETTERS = "abcd"


def mcq(prompt: str, options: list[str], correct: int, explanation: str, points: int = 10) -> dict[str, Any]:
    return {
        "kind": "mcq",
        "prompt": prompt,
        "points": points,
        "options": [{"id": LETTERS[i], "text": text} for i, text in enumerate(options)],
        "correct_option_id": LETTERS[correct],
        "explanation": explanation,
    }


def code(
    prompt: str,
    starter: str,
    cases: list[dict[str, str]],
    explanation: str | None = None,
    points: int = 20,
) -> dict[str, Any]:
    return {
        "kind": "code",
        "prompt": prompt,
        "points": points,
        "starter_code": starter,
        "test_cases": [
            {"before": c.get("before", ""), "after": c.get("after", ""), "expected": c["expected"]}
            for c in cases
        ],
        "explanation": explanation,
    }


LANGUAGES = [
    {"slug": "python", "name": "Python", "runtime": "pyodide", "sort_order": 1},
    {"slug": "javascript", "name": "JavaScript", "runtime": "js", "sort_order": 2},
]

# ======================================================================== Python

PY_HELLO = r"""# โปรแกรมแรกของคุณ

โปรแกรมคือชุดคำสั่งที่เราสั่งให้คอมพิวเตอร์ทำตามทีละบรรทัด ใน Python การแสดงผลออกหน้าจอใช้ฟังก์ชัน `print()`

```python
print('Hello, world!')
```

## ข้อความ (string)

ข้อความต้องอยู่ในเครื่องหมายคำพูด จะใช้ `'...'` หรือ `"..."` ก็ได้

```python
print("สวัสดี")
print('Python สนุกมาก')
```

## คอมเมนต์

บรรทัดที่ขึ้นต้นด้วย `#` คือคอมเมนต์ คอมพิวเตอร์จะข้ามไป ใช้เขียนโน้ตอธิบายโค้ดให้คนอ่าน

```python
# บรรทัดนี้ไม่ถูกรัน
print("บรรทัดนี้ถูกรัน")
```

## ลองเลย

กด “นำไปลองในตัวแก้ไข” ที่ตัวอย่างด้านบน แล้วลองแก้ข้อความเอง จากนั้นทำแบบฝึกหัดด้านล่าง
"""

PY_VARIABLES = r"""# ตัวแปรและชนิดข้อมูล

ตัวแปรคือ “กล่องที่มีชื่อ” ไว้เก็บค่า สร้างด้วยเครื่องหมาย `=`

```python
name = "มะลิ"
age = 20
print(name)
print(age)
```

## ชนิดข้อมูลพื้นฐาน

- `str` ข้อความ เช่น `"สวัสดี"`
- `int` จำนวนเต็ม เช่น `42`
- `float` ทศนิยม เช่น `3.14`
- `bool` จริงหรือเท็จ มีแค่ `True` กับ `False`

ใช้ `type()` ดูชนิดของค่าได้

```python
print(type(42))
print(type(3.14))
print(type("hi"))
print(type(True))
```

## คำนวณ

- `+` บวก, `-` ลบ, `*` คูณ
- `/` หาร (ได้ทศนิยมเสมอ)
- `//` หารแล้วเอาเฉพาะส่วนจำนวนเต็ม
- `%` เศษจากการหาร
- `**` ยกกำลัง

```python
print(7 / 2)
print(7 // 2)
print(7 % 2)
print(2 ** 10)
```

## f-string

ใส่ตัวแปรลงในข้อความได้โดยขึ้นต้นด้วย `f` แล้วใช้ `{}`

```python
name = "มะลิ"
print(f"สวัสดี {name}!")
```
"""

PY_CONDITIONS = r"""# เงื่อนไข (if)

โปรแกรมตัดสินใจเลือกทำงานตามเงื่อนไขได้ด้วย `if`

```python
age = 20
if age >= 18:
    print("เป็นผู้ใหญ่")
else:
    print("ยังไม่ถึง 18")
```

**สังเกต:** โค้ดที่อยู่ใต้ `if` / `else` ต้องเว้นวรรคเข้าไป (นิยมใช้ 4 ช่อง) และบรรทัด `if` / `else` ต้องลงท้ายด้วย `:`

## เครื่องหมายเปรียบเทียบ

- `==` เท่ากับ (ระวัง: `=` ใช้กำหนดค่า ไม่ใช่เปรียบเทียบ)
- `!=` ไม่เท่ากับ
- `>` `<` `>=` `<=`

## หลายเงื่อนไข ด้วย elif

```python
score = 72
if score >= 80:
    print("A")
elif score >= 60:
    print("B")
else:
    print("C")
```

## and, or, not

```python
x = 5
print(x > 3 and x < 10)
print(x < 3 or x > 4)
print(not x == 5)
```
"""

PY_LOOPS = r"""# การวนซ้ำ (loop)

เมื่ออยากทำสิ่งเดิมหลายรอบ ไม่ต้องเขียนโค้ดซ้ำ ใช้ loop แทน

## for กับ range

```python
for i in range(3):
    print(i)
```

`range(3)` ให้ค่า 0, 1, 2 (เริ่มที่ 0 และไม่รวม 3) ถ้าอยากกำหนดจุดเริ่ม ใช้ `range(1, 4)` ได้ 1, 2, 3

## while

วนซ้ำตราบใดที่เงื่อนไขยังเป็นจริง

```python
count = 3
while count > 0:
    print(count)
    count = count - 1
print("เริ่ม!")
```

ระวัง loop ที่ไม่มีวันจบ (เช่น ลืมลดค่า `count`) ที่นี่ระบบจะหยุดให้เองหลัง 10 วินาที

## break และ continue

- `break` ออกจาก loop ทันที
- `continue` ข้ามไปรอบถัดไป

```python
for i in range(1, 6):
    if i == 3:
        continue
    print(i)
```

## สะสมค่า

```python
total = 0
for i in range(1, 5):
    total = total + i
print(total)
```
"""

PY_FUNCTIONS = r"""# ฟังก์ชัน

ฟังก์ชันคือชุดคำสั่งที่ตั้งชื่อไว้ เรียกใช้ซ้ำได้หลายครั้ง สร้างด้วย `def`

```python
def greet(name):
    print(f"สวัสดี {name}!")

greet("มะลิ")
greet("ต้น")
```

## return

`return` ส่งค่ากลับให้ผู้เรียกใช้ (ต่างจาก `print` ที่แค่แสดงผลออกหน้าจอ)

```python
def add(a, b):
    return a + b

result = add(3, 4)
print(result)
```

## ค่าเริ่มต้นของพารามิเตอร์

```python
def power(x, n=2):
    return x ** n

print(power(3))
print(power(2, 5))
```

ฟังก์ชันที่ไม่มี `return` จะคืนค่า `None` (แปลว่า “ไม่มีค่า”)
"""

PY_LESSONS = [
    {
        "slug": "hello-world",
        "title": "โปรแกรมแรกของคุณ",
        "minutes": 5,
        "starter": "print('Hello, world!')\n",
        "content": PY_HELLO,
        "exercises": [
            mcq(
                "ฟังก์ชันใดใช้แสดงผลออกหน้าจอใน Python",
                ["echo()", "print()", "console.log()", "write()"],
                1,
                "print() เป็นฟังก์ชันมาตรฐานของ Python ส่วน console.log() เป็นของ JavaScript",
            ),
            code(
                "เขียนโปรแกรมที่แสดงคำว่า Hello, world! ออกหน้าจอ",
                "# เขียนโค้ดตรงนี้\n",
                [{"expected": "Hello, world!"}],
                "ใช้ print('Hello, world!') ตัวพิมพ์เล็ก-ใหญ่และเครื่องหมายต้องตรงกันทุกตัว",
            ),
            mcq(
                "สัญลักษณ์ใดใช้เขียนคอมเมนต์ใน Python",
                ["//", "#", "<!-- -->", "**"],
                1,
                "บรรทัดที่ขึ้นต้นด้วย # เป็นคอมเมนต์ (// เป็นของ JavaScript)",
            ),
        ],
    },
    {
        "slug": "variables",
        "title": "ตัวแปรและชนิดข้อมูล",
        "minutes": 10,
        "starter": 'name = "มะลิ"\nage = 20\nprint(f"{name} อายุ {age} ปี")\n',
        "content": PY_VARIABLES,
        "exercises": [
            mcq(
                "ค่า `3.14` มีชนิดข้อมูลใด",
                ["int", "float", "str", "bool"],
                1,
                "3.14 เป็นทศนิยม จึงเป็นชนิด float",
            ),
            mcq(
                "`7 // 2` ได้ผลลัพธ์เท่าไร",
                ["3.5", "3", "4", "1"],
                1,
                "// คือการหารแล้วเอาเฉพาะส่วนจำนวนเต็ม 7 หาร 2 ได้ 3 เศษ 1 (ถ้าใช้ / จะได้ 3.5)",
            ),
            code(
                "ตัวแปร `price` (ราคาต่อชิ้น) และ `qty` (จำนวนชิ้น) ถูกกำหนดไว้ให้แล้ว ให้แสดง “ราคารวม” ออกหน้าจอ",
                "# price และ qty ถูกกำหนดค่าไว้ให้แล้ว ไม่ต้องประกาศเอง\n",
                [
                    {"before": "price = 120\nqty = 3", "expected": "360"},
                    {"before": "price = 50\nqty = 4", "expected": "200"},
                    {"before": "price = 99\nqty = 1", "expected": "99"},
                ],
                "คำตอบ: print(price * qty) ระบบรันโค้ดของคุณหลายรอบด้วยค่า price/qty ที่ต่างกัน จึงต้องใช้ตัวแปรจริง ไม่ใช่พิมพ์ตัวเลขตรง ๆ",
            ),
        ],
    },
    {
        "slug": "conditions",
        "title": "เงื่อนไข (if)",
        "minutes": 10,
        "starter": 'score = 72\nif score >= 60:\n    print("ผ่าน")\nelse:\n    print("ไม่ผ่าน")\n',
        "content": PY_CONDITIONS,
        "exercises": [
            mcq(
                "`5 > 3 and 2 > 4` ได้ค่าอะไร",
                ["True", "False", "5", "Error"],
                1,
                "5 > 3 เป็นจริง แต่ 2 > 4 เป็นเท็จ and ต้องจริงทั้งสองฝั่ง ผลจึงเป็น False",
            ),
            mcq(
                "ข้อใดใช้ตรวจว่า `x` เท่ากับ 10",
                ["x = 10", "x == 10", "x === 10", "x equals 10"],
                1,
                "= ใช้กำหนดค่า ส่วน == ใช้เปรียบเทียบ (=== ไม่มีใน Python)",
            ),
            code(
                "ตัวแปร `score` ถูกกำหนดไว้ให้แล้ว ถ้า score ตั้งแต่ 50 ขึ้นไปให้แสดง ผ่าน ถ้าน้อยกว่านั้นให้แสดง ไม่ผ่าน",
                "# score ถูกกำหนดค่าไว้ให้แล้ว\n",
                [
                    {"before": "score = 75", "expected": "ผ่าน"},
                    {"before": "score = 40", "expected": "ไม่ผ่าน"},
                    {"before": "score = 50", "expected": "ผ่าน"},
                    {"before": "score = 49", "expected": "ไม่ผ่าน"},
                ],
                "ใช้ if score >= 50: ... else: ... สังเกตว่า 50 พอดีต้องผ่าน จึงต้องใช้ >= ไม่ใช่ >",
            ),
        ],
    },
    {
        "slug": "loops",
        "title": "การวนซ้ำ (loop)",
        "minutes": 12,
        "starter": "for i in range(1, 6):\n    print(i)\n",
        "content": PY_LOOPS,
        "exercises": [
            mcq(
                "โค้ด `for i in range(3): print(i)` แสดงผลอะไร (บรรทัดละค่า)",
                ["1, 2, 3", "0, 1, 2", "0, 1, 2, 3", "1, 2"],
                1,
                "range(3) เริ่มที่ 0 และไม่รวม 3 จึงได้ 0, 1, 2",
            ),
            mcq(
                "คำสั่งใดใช้ออกจาก loop ทันที",
                ["continue", "break", "exit", "stop"],
                1,
                "break ออกจาก loop ส่วน continue แค่ข้ามไปรอบถัดไป",
            ),
            code(
                "ตัวแปร `n` ถูกกำหนดไว้ให้แล้ว ให้แสดงผลรวมของจำนวนเต็มตั้งแต่ 1 ถึง n (รวม n)",
                "# n ถูกกำหนดค่าไว้ให้แล้ว\n",
                [
                    {"before": "n = 5", "expected": "15"},
                    {"before": "n = 10", "expected": "55"},
                    {"before": "n = 1", "expected": "1"},
                ],
                "ใช้ total = 0 แล้ว for i in range(1, n + 1): total = total + i จากนั้น print(total)",
            ),
        ],
    },
    {
        "slug": "functions",
        "title": "ฟังก์ชัน",
        "minutes": 12,
        "starter": "def add(a, b):\n    return a + b\n\nprint(add(3, 4))\n",
        "content": PY_FUNCTIONS,
        "exercises": [
            mcq(
                "คำสั่งใดใช้สร้างฟังก์ชันใน Python",
                ["function", "def", "func", "fn"],
                1,
                "Python ใช้ def ตามด้วยชื่อฟังก์ชันและวงเล็บ",
            ),
            mcq(
                "ฟังก์ชันที่ไม่มี `return` จะคืนค่าอะไร",
                ["0", "None", "ข้อความว่าง", "เกิด Error"],
                1,
                "ถ้าไม่มี return ฟังก์ชันจะคืน None ซึ่งแปลว่า “ไม่มีค่า”",
            ),
            code(
                "เขียนฟังก์ชัน `square(x)` ที่คืนค่า x คูณ x (ระบบจะเรียกฟังก์ชันของคุณให้ ไม่ต้อง print เอง)",
                "def square(x):\n    # เขียนโค้ดตรงนี้\n    pass\n",
                [
                    {"after": "print(square(4))", "expected": "16"},
                    {"after": "print(square(-3))", "expected": "9"},
                    {"after": "print(square(0))", "expected": "0"},
                ],
                "คำตอบ: return x * x ถ้าใช้ print ในฟังก์ชันแทน return ผลจะได้ None",
            ),
        ],
    },
]

# ======================================================================== JavaScript

JS_HELLO = r"""# โปรแกรมแรกของคุณ

โปรแกรมคือชุดคำสั่งที่เราสั่งให้คอมพิวเตอร์ทำตามทีละบรรทัด ใน JavaScript การแสดงผลออกหน้าจอ (console) ใช้ `console.log()`

```javascript
console.log('Hello, world!');
```

## ข้อความ (string)

ข้อความต้องอยู่ในเครื่องหมายคำพูด ใช้ `'...'` หรือ `"..."` ได้ และปิดท้ายคำสั่งด้วย `;`

```javascript
console.log("สวัสดี");
console.log('JavaScript สนุกมาก');
```

## คอมเมนต์

บรรทัดที่ขึ้นต้นด้วย `//` คือคอมเมนต์ คอมพิวเตอร์จะข้ามไป

```javascript
// บรรทัดนี้ไม่ถูกรัน
console.log("บรรทัดนี้ถูกรัน");
```

## ลองเลย

กด “นำไปลองในตัวแก้ไข” ที่ตัวอย่างด้านบน แล้วลองแก้ข้อความเอง จากนั้นทำแบบฝึกหัดด้านล่าง
"""

JS_VARIABLES = r"""# ตัวแปรและชนิดข้อมูล

ตัวแปรคือ “กล่องที่มีชื่อ” ไว้เก็บค่า ประกาศด้วย `let` (เปลี่ยนค่าได้) หรือ `const` (เปลี่ยนค่าไม่ได้)

```javascript
const name = "มะลิ";
let age = 20;
age = 21;
console.log(name, age);
```

ถ้าพยายามกำหนดค่าใหม่ให้ `const` จะเกิด error `Assignment to constant variable.` เลือกใช้ `const` เป็นค่าเริ่มต้น และใช้ `let` เมื่อค่าต้องเปลี่ยนจริง ๆ

## ชนิดข้อมูลพื้นฐาน

- `string` ข้อความ เช่น `"สวัสดี"`
- `number` ตัวเลข (ทั้งจำนวนเต็มและทศนิยม) เช่น `42`, `3.14`
- `boolean` จริงหรือเท็จ มีแค่ `true` กับ `false`
- `undefined` ตัวแปรที่ยังไม่มีค่า

ใช้ `typeof` ดูชนิดของค่าได้

```javascript
console.log(typeof 42);
console.log(typeof 3.14);
console.log(typeof "hi");
console.log(typeof true);
```

## คำนวณ

- `+` บวก, `-` ลบ, `*` คูณ, `/` หาร
- `%` เศษจากการหาร
- `**` ยกกำลัง

```javascript
console.log(7 / 2);
console.log(Math.floor(7 / 2));
console.log(7 % 2);
console.log(2 ** 10);
```

## Template literal

ใส่ตัวแปรลงในข้อความด้วยเครื่องหมาย backtick และ `${}`

```javascript
const name = "มะลิ";
console.log(`สวัสดี ${name}!`);
```
"""

JS_CONDITIONS = r"""# เงื่อนไข (if)

โปรแกรมตัดสินใจเลือกทำงานตามเงื่อนไขได้ด้วย `if`

```javascript
const age = 20;
if (age >= 18) {
  console.log("เป็นผู้ใหญ่");
} else {
  console.log("ยังไม่ถึง 18");
}
```

เงื่อนไขอยู่ในวงเล็บ และโค้ดที่ต้องการให้ทำงานอยู่ในปีกกา `{ }`

## เครื่องหมายเปรียบเทียบ

- `===` เท่ากับ (เทียบทั้งค่าและชนิด แนะนำให้ใช้เสมอ)
- `!==` ไม่เท่ากับ
- `>` `<` `>=` `<=`

```javascript
console.log(5 === "5");
console.log(5 == "5");
```

`==` จะแปลงชนิดให้ก่อนเทียบ ทำให้ผลชวนงง จึงไม่แนะนำ

## หลายเงื่อนไข ด้วย else if

```javascript
const score = 72;
if (score >= 80) {
  console.log("A");
} else if (score >= 60) {
  console.log("B");
} else {
  console.log("C");
}
```

## &&, ||, !

```javascript
const x = 5;
console.log(x > 3 && x < 10);
console.log(x < 3 || x > 4);
console.log(!(x === 5));
```
"""

JS_LOOPS = r"""# การวนซ้ำ (loop)

เมื่ออยากทำสิ่งเดิมหลายรอบ ไม่ต้องเขียนโค้ดซ้ำ ใช้ loop แทน

## for

```javascript
for (let i = 0; i < 3; i++) {
  console.log(i);
}
```

ในวงเล็บมี 3 ส่วน: จุดเริ่ม (`let i = 0`), เงื่อนไขที่ต้องจริงถึงจะวนต่อ (`i < 3`) และสิ่งที่ทำหลังจบแต่ละรอบ (`i++` คือเพิ่มทีละ 1) ผลที่ได้คือ 0, 1, 2

## while

วนซ้ำตราบใดที่เงื่อนไขยังเป็นจริง

```javascript
let count = 3;
while (count > 0) {
  console.log(count);
  count = count - 1;
}
console.log("เริ่ม!");
```

ระวัง loop ที่ไม่มีวันจบ (เช่น ลืมลดค่า `count`) ที่นี่ระบบจะหยุดให้เองหลัง 10 วินาที

## break และ continue

- `break` ออกจาก loop ทันที
- `continue` ข้ามไปรอบถัดไป

```javascript
for (let i = 1; i <= 5; i++) {
  if (i === 3) {
    continue;
  }
  console.log(i);
}
```

## สะสมค่า

```javascript
let total = 0;
for (let i = 1; i <= 4; i++) {
  total = total + i;
}
console.log(total);
```
"""

JS_FUNCTIONS = r"""# ฟังก์ชัน

ฟังก์ชันคือชุดคำสั่งที่ตั้งชื่อไว้ เรียกใช้ซ้ำได้หลายครั้ง สร้างด้วย `function`

```javascript
function greet(name) {
  console.log(`สวัสดี ${name}!`);
}

greet("มะลิ");
greet("ต้น");
```

## return

`return` ส่งค่ากลับให้ผู้เรียกใช้ (ต่างจาก `console.log` ที่แค่แสดงผลออกหน้าจอ)

```javascript
function add(a, b) {
  return a + b;
}

const result = add(3, 4);
console.log(result);
```

## Arrow function

อีกวิธีเขียนฟังก์ชันให้สั้นลง

```javascript
const double = (x) => x * 2;
console.log(double(5));
```

## ค่าเริ่มต้นของพารามิเตอร์

```javascript
function power(x, n = 2) {
  return x ** n;
}

console.log(power(3));
console.log(power(2, 5));
```

ฟังก์ชันที่ไม่มี `return` จะคืนค่า `undefined` (แปลว่า “ไม่มีค่า”)
"""

JS_LESSONS = [
    {
        "slug": "hello-world",
        "title": "โปรแกรมแรกของคุณ",
        "minutes": 5,
        "starter": "console.log('Hello, world!');\n",
        "content": JS_HELLO,
        "exercises": [
            mcq(
                "คำสั่งใดใช้แสดงข้อความออก console ใน JavaScript",
                ["print()", "console.log()", "echo()", "System.out.println()"],
                1,
                "console.log() แสดงค่าออก console ส่วน System.out.println() เป็นของ Java",
            ),
            code(
                "เขียนโปรแกรมที่แสดงคำว่า Hello, world! ออกหน้าจอ",
                "// เขียนโค้ดตรงนี้\n",
                [{"expected": "Hello, world!"}],
                "ใช้ console.log('Hello, world!'); ตัวพิมพ์เล็ก-ใหญ่และเครื่องหมายต้องตรงกันทุกตัว",
            ),
            mcq(
                "สัญลักษณ์ใดใช้เขียนคอมเมนต์ใน JavaScript",
                ["#", "//", "<!-- -->", "--"],
                1,
                "บรรทัดที่ขึ้นต้นด้วย // เป็นคอมเมนต์ (# เป็นของ Python)",
            ),
        ],
    },
    {
        "slug": "variables",
        "title": "ตัวแปรและชนิดข้อมูล",
        "minutes": 10,
        "starter": 'const name = "มะลิ";\nlet age = 20;\nconsole.log(`${name} อายุ ${age} ปี`);\n',
        "content": JS_VARIABLES,
        "exercises": [
            mcq(
                "`typeof 3.14` ได้ค่าอะไรใน JavaScript",
                ['"float"', '"number"', '"decimal"', '"double"'],
                1,
                'JavaScript มีชนิดตัวเลขชนิดเดียวคือ number ใช้ทั้งจำนวนเต็มและทศนิยม',
            ),
            mcq(
                "ตัวแปรที่ประกาศด้วยคำสั่งใดจะกำหนดค่าใหม่ไม่ได้",
                ["var", "let", "const", "static"],
                2,
                "const ย่อจาก constant (ค่าคงที่) กำหนดค่าใหม่แล้วจะเกิด error",
            ),
            code(
                "ค่าคงที่ `price` (ราคาต่อชิ้น) และ `qty` (จำนวนชิ้น) ถูกประกาศไว้ให้แล้ว ให้แสดง “ราคารวม” ออกหน้าจอ (อย่าประกาศชื่อซ้ำ)",
                "// price และ qty ถูกประกาศไว้ให้แล้ว\n",
                [
                    {"before": "const price = 120;\nconst qty = 3;", "expected": "360"},
                    {"before": "const price = 50;\nconst qty = 4;", "expected": "200"},
                    {"before": "const price = 99;\nconst qty = 1;", "expected": "99"},
                ],
                "คำตอบ: console.log(price * qty); ระบบรันโค้ดของคุณหลายรอบด้วยค่าที่ต่างกัน จึงต้องใช้ตัวแปรจริง",
            ),
        ],
    },
    {
        "slug": "conditions",
        "title": "เงื่อนไข (if)",
        "minutes": 10,
        "starter": 'const score = 72;\nif (score >= 60) {\n  console.log("ผ่าน");\n} else {\n  console.log("ไม่ผ่าน");\n}\n',
        "content": JS_CONDITIONS,
        "exercises": [
            mcq(
                '`5 === "5"` ได้ค่าอะไร',
                ["true", "false", "5", "Error"],
                1,
                '=== เทียบทั้งค่าและชนิด 5 เป็น number แต่ "5" เป็น string จึงไม่เท่ากัน',
            ),
            mcq(
                "`true && false || true` ได้ค่าอะไร",
                ["true", "false", "undefined", "Error"],
                0,
                "&& ถูกคำนวณก่อน: true && false ได้ false แล้ว false || true ได้ true",
            ),
            code(
                "ค่าคงที่ `score` ถูกประกาศไว้ให้แล้ว ถ้า score ตั้งแต่ 50 ขึ้นไปให้แสดง ผ่าน ถ้าน้อยกว่านั้นให้แสดง ไม่ผ่าน",
                "// score ถูกประกาศไว้ให้แล้ว\n",
                [
                    {"before": "const score = 75;", "expected": "ผ่าน"},
                    {"before": "const score = 40;", "expected": "ไม่ผ่าน"},
                    {"before": "const score = 50;", "expected": "ผ่าน"},
                    {"before": "const score = 49;", "expected": "ไม่ผ่าน"},
                ],
                "ใช้ if (score >= 50) { ... } else { ... } สังเกตว่า 50 พอดีต้องผ่าน จึงต้องใช้ >= ไม่ใช่ >",
            ),
        ],
    },
    {
        "slug": "loops",
        "title": "การวนซ้ำ (loop)",
        "minutes": 12,
        "starter": "for (let i = 1; i <= 5; i++) {\n  console.log(i);\n}\n",
        "content": JS_LOOPS,
        "exercises": [
            mcq(
                "โค้ด `for (let i = 0; i < 3; i++) console.log(i)` แสดงผลอะไร (บรรทัดละค่า)",
                ["1, 2, 3", "0, 1, 2", "0, 1, 2, 3", "1, 2"],
                1,
                "i เริ่มที่ 0 และวนต่อเมื่อ i < 3 จึงได้ 0, 1, 2",
            ),
            mcq(
                "คำสั่งใดใช้ข้ามรอบปัจจุบันแล้วไปรอบถัดไป",
                ["break", "continue", "skip", "next"],
                1,
                "continue ข้ามไปรอบถัดไป ส่วน break ออกจาก loop เลย",
            ),
            code(
                "ค่าคงที่ `n` ถูกประกาศไว้ให้แล้ว ให้แสดงผลรวมของจำนวนเต็มตั้งแต่ 1 ถึง n (รวม n)",
                "// n ถูกประกาศไว้ให้แล้ว\n",
                [
                    {"before": "const n = 5;", "expected": "15"},
                    {"before": "const n = 10;", "expected": "55"},
                    {"before": "const n = 1;", "expected": "1"},
                ],
                "ใช้ let total = 0; แล้ว for (let i = 1; i <= n; i++) { total = total + i; } จากนั้น console.log(total);",
            ),
        ],
    },
    {
        "slug": "functions",
        "title": "ฟังก์ชัน",
        "minutes": 12,
        "starter": "function add(a, b) {\n  return a + b;\n}\n\nconsole.log(add(3, 4));\n",
        "content": JS_FUNCTIONS,
        "exercises": [
            mcq(
                "ข้อใดเขียน arrow function ที่คูณค่าด้วย 2 ได้ถูกต้อง",
                ["function => (x) x * 2", "const f = (x) => x * 2", "def f(x): return x * 2", "f(x) -> x * 2"],
                1,
                "arrow function เขียนเป็น (พารามิเตอร์) => ค่าที่คืน",
            ),
            mcq(
                "ฟังก์ชันที่ไม่มี `return` จะคืนค่าอะไร",
                ["0", "null", "undefined", "ข้อความว่าง"],
                2,
                "ถ้าไม่มี return ฟังก์ชันจะคืน undefined ซึ่งแปลว่า “ไม่มีค่า”",
            ),
            code(
                "เขียนฟังก์ชัน `square(x)` ที่คืนค่า x คูณ x (ระบบจะเรียกฟังก์ชันของคุณให้ ไม่ต้อง console.log เอง)",
                "function square(x) {\n  // เขียนโค้ดตรงนี้\n}\n",
                [
                    {"after": "console.log(square(4));", "expected": "16"},
                    {"after": "console.log(square(-3));", "expected": "9"},
                    {"after": "console.log(square(0));", "expected": "0"},
                ],
                "คำตอบ: return x * x; ถ้าลืม return ผลจะเป็น undefined",
            ),
        ],
    },
]

COURSES = [
    {
        "language": "python",
        "slug": "python-basics",
        "title": "Python เบื้องต้น",
        "description": "เริ่มจากศูนย์จนเขียนโปรแกรมเล็ก ๆ ได้",
        "level": "beginner",
        "sort_order": 1,
        "lessons": PY_LESSONS,
    },
    {
        "language": "javascript",
        "slug": "javascript-basics",
        "title": "JavaScript เบื้องต้น",
        "description": "พื้นฐานภาษาที่ทำให้เว็บมีชีวิต",
        "level": "beginner",
        "sort_order": 2,
        "lessons": JS_LESSONS,
    },
]
