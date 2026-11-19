FROM python:3.12-slim
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWITEBYTECODE=1
WORKDIR /app
COPY requirements.txt
RUN pip install -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["fastapi", "run", "main.py"]