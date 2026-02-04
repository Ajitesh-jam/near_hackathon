# Python DAO agent (replaces Node/TS app)
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY src/ ./src/

ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app
ENV PYTHONFAULTHANDLER=1
EXPOSE 3000

# --log-level info and no --no-access-log so Phala Cloud can capture logs
CMD ["python", "-m", "uvicorn", "src.index:app", "--host", "0.0.0.0", "--port", "3000", "--log-level", "info"]
