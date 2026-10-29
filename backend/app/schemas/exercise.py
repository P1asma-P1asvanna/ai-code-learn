from pydantic import BaseModel, Field, field_validator

from app.services.grading import MAX_OUTPUT_CHARS


class SubmitIn(BaseModel):
    # mcq: รหัสตัวเลือก (เช่น "b") | code: โค้ดที่ผู้เรียนเขียน (เก็บไว้ดูย้อนหลัง)
    answer: str | None = Field(default=None, max_length=20000)
    # code เท่านั้น: ผลลัพธ์ของการรันโค้ดกับ test case แต่ละข้อ (ตามลำดับ)
    outputs: list[str] | None = Field(default=None, max_length=10)

    @field_validator("outputs")
    @classmethod
    def _truncate_outputs(cls, value: list[str] | None) -> list[str] | None:
        if value is None:
            return None
        return [item[:MAX_OUTPUT_CHARS] for item in value]
