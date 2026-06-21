"""
Train a Random Forest risk model on synthetic learner data.

Run once before starting the server:
    python train_risk_model.py

Outputs:
    risk_model.pkl   — saved in the same directory
    risk_data.csv    — the training dataset (kept for inspection)
"""

from __future__ import annotations

import random
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error

RANDOM_SEED = 42
N_ROWS = 1000
OUTPUT_DIR = Path(__file__).parent.parent

_STATUS_ENCODING = {0: "placed", 1: "active", 2: "at_risk", 3: "dropped"}
_STATUS_SCORE = {0: 0.0, 1: 10.0, 2: 30.0, 3: 50.0}


def _heuristic_score(row: dict) -> float:
    score = 0.0
    score += min(row["days_since_last_response"] * 2.5, 40.0)
    score += _STATUS_SCORE[row["status_encoded"]]
    score += (1.0 - row["profile_completeness"] / 100.0) * 20.0
    score += max(0.0, (30.0 - row["days_to_cohort_end"]) / 3.0)
    return float(np.clip(score, 0.0, 100.0))


def generate_data(n: int = N_ROWS, seed: int = RANDOM_SEED) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    rows = []
    for _ in range(n):
        status_encoded = int(rng.choice([0, 1, 2, 3], p=[0.25, 0.50, 0.15, 0.10]))
        row = {
            "days_since_last_response": int(rng.integers(0, 30)),
            "status_encoded": status_encoded,
            "profile_completeness": float(rng.uniform(20, 100)),
            "days_to_cohort_end": int(rng.integers(0, 120)),
        }
        base = _heuristic_score(row)
        # Add realistic noise so the RF learns generalisation, not just heuristic
        noise = float(rng.normal(0, 5))
        row["risk_score"] = float(np.clip(base + noise, 0.0, 100.0))
        rows.append(row)
    return pd.DataFrame(rows)


def train(df: pd.DataFrame) -> RandomForestRegressor:
    features = ["days_since_last_response", "status_encoded", "profile_completeness", "days_to_cohort_end"]
    X = df[features].values
    y = df["risk_score"].values

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=RANDOM_SEED)

    model = RandomForestRegressor(n_estimators=100, random_state=RANDOM_SEED, n_jobs=-1)
    model.fit(X_train, y_train)

    mae = mean_absolute_error(y_test, model.predict(X_test))
    print(f"Trained RandomForestRegressor — test MAE: {mae:.2f}")
    return model


def main() -> None:
    print(f"Generating {N_ROWS} rows of synthetic learner data...")
    df = generate_data()

    csv_path = OUTPUT_DIR / "risk_data.csv"
    df.to_csv(csv_path, index=False)
    print(f"Saved training data → {csv_path}")

    print("Training model...")
    model = train(df)

    pkl_path = OUTPUT_DIR / "risk_model.pkl"
    joblib.dump(model, pkl_path)
    print(f"Saved model → {pkl_path}")
    print("Done. Re-start the server to pick up the new model.")


if __name__ == "__main__":
    main()
