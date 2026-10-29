"""ตรวจคำตอบแบบฝึกหัด — ฟังก์ชันล้วน ๆ ไม่แตะฐานข้อมูล (ทดสอบได้ด้วย standard library)

แบบฝึกหัดเขียนโค้ด: โค้ดรันในเบราว์เซอร์ของผู้เรียน แล้วส่ง "ผลลัพธ์ที่ได้" มาให้ backend เทียบกับผลที่คาดหวัง
(ผู้เรียนที่อยากโกงคะแนนตัวเองก็ทำได้ ซึ่งยอมรับได้สำหรับ MVP — คะแนนไม่ได้ใช้แข่งกับใคร)
"""

from __future__ import annotations

from typing import Any

MAX_OUTPUT_CHARS = 20_000


def normalize_output(text: str | None) -> str:
    """เทียบผลลัพธ์แบบไม่ซีเรียสเรื่องช่องว่างท้ายบรรทัดและบรรทัดว่างท้ายสุด"""
    if not text:
        return ""
    lines = text.replace("\r\n", "\n").replace("\r", "\n").split("\n")
    return "\n".join(line.rstrip() for line in lines).strip("\n")


def grade_mcq(correct_option_id: str | None, answer: str | None) -> bool:
    return bool(correct_option_id) and answer == correct_option_id


def grade_code(cases: list[dict[str, Any]], outputs: list[str]) -> list[dict[str, Any]]:
    """คืนผลต่อ test case: {"passed": bool, "expected": str}  (จำนวน outputs ต้องเท่ากับ cases — ผู้เรียกตรวจแล้ว)"""
    results = []
    for case, actual in zip(cases, outputs, strict=True):
        expected = normalize_output(str(case.get("expected", "")))
        results.append(
            {
                "passed": normalize_output(actual[:MAX_OUTPUT_CHARS]) == expected,
                "expected": expected,
            }
        )
    return results


def public_cases(cases: list[dict[str, Any]] | None) -> list[dict[str, str]]:
    """ข้อมูล test case ที่ส่งให้ frontend: ต้องรู้ว่าจะรันอะไร แต่ไม่ส่งผลที่คาดหวังไปให้"""
    return [
        {"before": str(case.get("before", "")), "after": str(case.get("after", ""))}
        for case in (cases or [])
    ]
