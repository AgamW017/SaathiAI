"""
SaathiAI AI server.

Endpoints:
    POST /convert       — Docling document parsing (multipart/form-data)
    POST /predict-risk  — Learner dropout risk score (JSON body)
    GET  /health        — Liveness check
"""

import logging
import tempfile
import os
from pathlib import Path
from typing import Any

from fastapi import FastAPI, UploadFile, File
from fastapi.responses import JSONResponse
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel
import uvicorn

from risk_model import predict as _predict_risk

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

app = FastAPI()

SUPPORTED_MIME_TYPES = {
    "application/pdf",
    "image/jpeg",
    "image/png",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}

MIME_TO_EXT = {
    "application/pdf": ".pdf",
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
}


def _build_converter(use_gpu: bool):
    from docling.document_converter import DocumentConverter, PdfFormatOption
    from docling.datamodel.pipeline_options import PdfPipelineOptions, AcceleratorOptions, AcceleratorDevice

    accel = AcceleratorOptions(
        num_threads=4,
        device=AcceleratorDevice.CUDA if use_gpu else AcceleratorDevice.CPU,
    )
    pdf_opts = PdfPipelineOptions(accelerator_options=accel)
    return DocumentConverter(
        format_options={"pdf": PdfFormatOption(pipeline_options=pdf_opts)}
    )


def _convert(file_bytes: bytes, mime_type: str, filename: str):
    ext = MIME_TO_EXT.get(mime_type, "")
    with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
        tmp.write(file_bytes)
        tmp_path = tmp.name

    try:
        for use_gpu in (True, False):
            try:
                label = "GPU" if use_gpu else "CPU"
                log.info("Attempting conversion with %s: %s", label, filename)
                converter = _build_converter(use_gpu)
                result = converter.convert(tmp_path)
                doc = result.document
                text = doc.export_to_markdown()
                pages = getattr(doc, "num_pages", None) or len(getattr(doc, "pages", []) or []) or None
                log.info("Converted %s with %s (%d chars)", filename, label, len(text))
                return text, pages
            except Exception as exc:
                if use_gpu:
                    log.warning("GPU conversion failed (%s), retrying with CPU", exc)
                else:
                    raise
    finally:
        os.unlink(tmp_path)


@app.post("/convert")
async def convert(file: UploadFile = File(...)):
    mime_type = file.content_type or ""
    filename = file.filename or "document"

    if mime_type not in SUPPORTED_MIME_TYPES:
        return JSONResponse(status_code=415, content={"error": f"Unsupported MIME type: {mime_type}"})

    file_bytes = await file.read()
    if not file_bytes:
        return JSONResponse(status_code=400, content={"error": "Empty file"})

    try:
        text, pages = await run_in_threadpool(_convert, file_bytes, mime_type, filename)
        return {"text": text, "pages": pages, "metadata": {}}
    except Exception as exc:
        log.exception("Conversion failed for %s", filename)
        return JSONResponse(status_code=500, content={"error": str(exc), "message": f"Failed to parse document: {exc}"})


class RiskRequest(BaseModel):
    learner_id: str = ""
    days_since_last_response: int = 0
    status: str = "active"
    profile_completeness: float = 100.0
    days_to_cohort_end: int = 90


@app.post("/predict-risk")
async def predict_risk(body: RiskRequest):
    score = _predict_risk(body.model_dump())
    log.info("predict-risk learner=%s score=%.2f", body.learner_id or "?", score)
    return {"score": score}


@app.get("/health")
def health():
    return {"status": "ok"}


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    log.info("Starting docling server on port %d", port)
    uvicorn.run(app, host="0.0.0.0", port=port)
