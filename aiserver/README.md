# SaathiAI AI Server

This is the Python-based AI server for SaathiAI, providing document parsing and machine learning inference endpoints.

## Features

- **Document Conversion (`/convert`)**: Uses `docling` to extract text and structured tables from PDFs, Images, and DOCX files.
  - Supports GPU acceleration for faster OCR and layout parsing if available.
  - Returns raw markdown `text`, page count, and structured 2D `tables` (arrays of arrays of strings).
- **Dropout Risk Prediction (`/predict-risk`)**: Uses a trained machine learning model to predict a learner's risk of dropping out based on their activity metrics.

## Requirements

- Python >= 3.10
- `uv` (recommended for dependency management)

## Setup

1. Install dependencies using `uv`:
   ```bash
   uv pip install --python .venv/bin/python -r requirements.txt
   ```
2. For GPU support, ensure you have the appropriate PyTorch version installed that matches your system's CUDA version (e.g., `torch==2.5.1+cu121`).

## Running the Server

Start the server using `uvicorn`:
```bash
python server.py
```
By default, the server runs on `http://0.0.0.0:5000`.

## Endpoints

### `POST /convert`
Upload a document (`multipart/form-data` with a `file` field) to extract its contents.
**Returns:**
```json
{
  "text": "...",
  "pages": 5,
  "tables": [
    [
      ["Name", "Phone", "Trade"],
      ["John Doe", "9876543210", "Electrician"]
    ]
  ],
  "metadata": {}
}
```

### `POST /predict-risk`
Submit learner metrics to get a dropout risk score.
**Returns:**
```json
{
  "score": 0.85
}
```