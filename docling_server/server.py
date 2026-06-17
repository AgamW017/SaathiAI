"""
Docling document parsing server.
POST /convert — accepts multipart/form-data with a 'file' field.
Returns: { "text": str, "pages": int|null, "metadata": {} }

GPU is attempted first via docling's accelerator_options; falls back to CPU on error.
"""

import io
import logging
import tempfile
import os
from pathlib import Path

from flask import Flask, request, jsonify

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

app = Flask(__name__)

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


@app.route("/convert", methods=["POST"])
def convert():
    if "file" not in request.files:
        return jsonify({"error": "No file field in request"}), 400

    f = request.files["file"]
    mime_type = f.mimetype or f.content_type or ""
    filename = f.filename or "document"

    if mime_type not in SUPPORTED_MIME_TYPES:
        return jsonify({"error": f"Unsupported MIME type: {mime_type}"}), 415

    file_bytes = f.read()
    if not file_bytes:
        return jsonify({"error": "Empty file"}), 400

    try:
        text, pages = _convert(file_bytes, mime_type, filename)
        return jsonify({"text": text, "pages": pages, "metadata": {}})
    except Exception as exc:
        log.exception("Conversion failed for %s", filename)
        return jsonify({"error": str(exc), "message": f"Failed to parse document: {exc}"}), 500


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    log.info("Starting docling server on port %d", port)
    app.run(host="0.0.0.0", port=port)
