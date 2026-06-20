"""
Risk model for learner dropout prediction.

Loads a trained Random Forest from risk_model.pkl when available.
Falls back to a rule-based heuristic if the model file is absent.

Input dict keys:
    days_since_last_response  int   Days learner has been silent
    status                    str   'active' | 'placed' | 'at_risk' | 'dropped'
    profile_completeness      float 0–100 (% of key profile fields filled)
    days_to_cohort_end        int   Days remaining in learner's cohort

Returns:
    float  Risk score 0.0 – 100.0  (higher = more at-risk)
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any

import joblib
import numpy as np

_MODEL_PATH = Path(__file__).parent / "risk_model.pkl"
_STATUS_ENCODING = {"placed": 0, "active": 1, "at_risk": 2, "dropped": 3}

# Attempt to load the trained model at import time.
_model: Any = None
if _MODEL_PATH.exists():
    try:
        _model = joblib.load(_MODEL_PATH)
    except Exception:
        _model = None


def _heuristic(data: dict) -> float:
    score = 0.0

    days_silent = float(data.get("days_since_last_response", 0))
    score += min(days_silent * 2.5, 40.0)

    status_scores = {"placed": 0.0, "active": 10.0, "at_risk": 30.0, "dropped": 50.0}
    score += status_scores.get(str(data.get("status", "active")), 10.0)

    completeness = float(data.get("profile_completeness", 100))
    score += (1.0 - completeness / 100.0) * 20.0

    days_to_end = float(data.get("days_to_cohort_end", 90))
    score += max(0.0, (30.0 - days_to_end) / 3.0)

    return float(np.clip(score, 0.0, 100.0))


def _features(data: dict) -> np.ndarray:
    return np.array([[
        float(data.get("days_since_last_response", 0)),
        float(_STATUS_ENCODING.get(str(data.get("status", "active")), 1)),
        float(data.get("profile_completeness", 100)),
        float(data.get("days_to_cohort_end", 90)),
    ]])


def predict(data: dict) -> float:
    """Return a risk score 0–100 for the given learner data dict."""
    if _model is not None:
        try:
            score = float(_model.predict(_features(data))[0])
            return float(np.clip(score, 0.0, 100.0))
        except Exception:
            pass
    return _heuristic(data)
