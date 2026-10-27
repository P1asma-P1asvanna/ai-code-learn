FROM python:3.12-slim

WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

# ไม่รันด้วย root
RUN useradd --create-home appuser
USER appuser

# Render ส่งพอร์ตมาทางตัวแปร PORT (ค่าเริ่มต้น 10000)
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
