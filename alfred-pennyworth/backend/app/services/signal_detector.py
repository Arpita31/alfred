"""
Signal Detector Service - ML-based pattern detection for wellness signals.

Uses numpy for statistical analysis and sklearn for anomaly detection.
Works on 14-day rolling windows with a minimum of 7 samples before making predictions.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Dict, Optional

import numpy as np

from app.core.config import settings
from app.core.logging import logger
from app.services.alfred_agent import Signal, SignalType


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _to_utc(dt: datetime) -> datetime:
    """Ensure a datetime is timezone-aware in UTC."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def _hours_ago(dt: datetime, now: datetime) -> float:
    return (now - _to_utc(dt)).total_seconds() / 3600


# ---------------------------------------------------------------------------
# Individual signal detectors
# ---------------------------------------------------------------------------

def detect_meal_gap(meals: List[Dict], now: datetime) -> Optional[Signal]:
    """Trigger when the last meal was more than 4 hours ago."""
    if not meals:
        return None

    last_meal_time = _to_utc(meals[0]["meal_time"])
    hours_since = _hours_ago(last_meal_time, now)

    if hours_since < 4:
        return None

    # Severity scales linearly: 4 h → 0.33, 8 h → 1.0
    severity = min(1.0, (hours_since - 4) / 4)
    confidence = min(0.95, 0.70 + severity * 0.25)

    return Signal(
        signal_type=SignalType.MEAL_GAP,
        confidence=confidence,
        severity=severity,
        data={"hours_since_last_meal": round(hours_since, 1)},
        reasoning=f"It has been {hours_since:.1f} hours since your last meal.",
    )


def detect_poor_sleep(sleep_records: List[Dict], now: datetime) -> Optional[Signal]:
    """
    Detect poor sleep using a 14-day rolling baseline.

    Triggers when last night's quality or duration is more than 1 stddev
    below the user's personal rolling mean.
    """
    if not sleep_records:
        return None

    # Only consider sessions that ended within the last 18 hours (last night / this morning)
    recent = [
        s for s in sleep_records
        if _hours_ago(_to_utc(s["sleep_end"]), now) <= 18
    ]
    if not recent:
        return None

    last = recent[0]
    last_quality = last.get("quality_score")
    last_duration = last.get("duration_minutes")

    if last_quality is None and last_duration is None:
        return None

    # Build rolling baseline from all records (up to 14-day window)
    qualities = [s["quality_score"] for s in sleep_records if s.get("quality_score") is not None]
    durations = [s["duration_minutes"] for s in sleep_records if s.get("duration_minutes") is not None]

    issues = []
    severity_parts = []

    # --- Quality check ---
    if last_quality is not None and len(qualities) >= settings.MIN_SAMPLES_FOR_PREDICTION:
        q_arr = np.array(qualities, dtype=float)
        q_mean, q_std = q_arr.mean(), max(q_arr.std(), 0.5)
        z_quality = (q_mean - last_quality) / q_std  # positive = below average
        if z_quality > 0.8 or last_quality < 5:
            issues.append(f"quality score {last_quality:.1f} (your avg: {q_mean:.1f})")
            severity_parts.append(min(1.0, z_quality / 2))
    elif last_quality is not None and last_quality < 5:
        issues.append(f"quality score {last_quality:.1f}/10")
        severity_parts.append(0.6)

    # --- Duration check ---
    IDEAL_MINUTES = 450  # 7.5 hours
    if last_duration is not None and len(durations) >= settings.MIN_SAMPLES_FOR_PREDICTION:
        d_arr = np.array(durations, dtype=float)
        d_mean, d_std = d_arr.mean(), max(d_arr.std(), 15.0)
        z_duration = (d_mean - last_duration) / d_std
        if z_duration > 0.8 or last_duration < 360:
            hours = last_duration / 60
            issues.append(f"only {hours:.1f} h of sleep (your avg: {d_mean / 60:.1f} h)")
            severity_parts.append(min(1.0, z_duration / 2))
    elif last_duration is not None and last_duration < 360:
        hours = last_duration / 60
        issues.append(f"only {hours:.1f} h of sleep")
        severity_parts.append(0.65)

    if not issues:
        return None

    severity = float(np.mean(severity_parts))
    confidence = min(0.92, 0.68 + severity * 0.24)

    return Signal(
        signal_type=SignalType.POOR_SLEEP,
        confidence=confidence,
        severity=severity,
        data={
            "quality_score": last_quality,
            "duration_minutes": last_duration,
            "issues": issues,
        },
        reasoning="Last night's sleep showed: " + "; ".join(issues) + ".",
    )


def detect_low_energy(
    sleep_records: List[Dict],
    activities_24h: List[Dict],
    now: datetime,
) -> Optional[Signal]:
    """
    Infer low energy from a combination of:
      - Sleep quality deficit vs rolling mean
      - High activity load in the last 24 hours
    """
    score = 0.0  # higher = more likely low energy

    # Sleep contribution
    if sleep_records:
        last = sleep_records[0]
        q = last.get("quality_score")
        d = last.get("duration_minutes")

        qualities = [s["quality_score"] for s in sleep_records if s.get("quality_score") is not None]
        if q is not None:
            if len(qualities) >= settings.MIN_SAMPLES_FOR_PREDICTION:
                q_mean = np.mean(qualities)
                deficit_ratio = max(0.0, (q_mean - q) / max(q_mean, 1))
                score += deficit_ratio * 0.5
            elif q < 5:
                score += 0.4

        if d is not None and d < 360:
            score += 0.3

    # Activity load contribution
    if activities_24h:
        total_calories = sum(a.get("calories_burned") or 0 for a in activities_24h)
        total_minutes = sum(a.get("duration_minutes") or 0 for a in activities_24h)
        if total_calories > 600 or total_minutes > 90:
            score += 0.3

    if score < 0.45:
        return None

    severity = min(1.0, score)
    confidence = min(0.88, 0.60 + severity * 0.28)

    return Signal(
        signal_type=SignalType.LOW_ENERGY,
        confidence=confidence,
        severity=severity,
        data={
            "energy_deficit_score": round(score, 2),
            "activity_count_24h": len(activities_24h),
        },
        reasoning=f"Energy deficit score is {score:.2f} based on recent sleep and activity load.",
    )


def detect_recovery_needed(
    activities: List[Dict],
    sleep_records: List[Dict],
    now: datetime,
) -> Optional[Signal]:
    """
    Trigger when recent activity load is anomalously high relative to the
    14-day baseline, and recovery sleep has been poor.

    Uses z-score on daily calorie burn over the rolling window.
    """
    if len(activities) < settings.MIN_SAMPLES_FOR_PREDICTION:
        return None

    # Group activities by day and sum calories
    day_calories: Dict[str, float] = {}
    for a in activities:
        day = _to_utc(a["start_time"]).date().isoformat()
        day_calories[day] = day_calories.get(day, 0.0) + (a.get("calories_burned") or 0)

    if len(day_calories) < 3:
        return None

    values = np.array(list(day_calories.values()), dtype=float)
    today_key = now.date().isoformat()
    today_load = day_calories.get(today_key, 0.0)

    mean_load = values.mean()
    std_load = max(values.std(), 50.0)
    z = (today_load - mean_load) / std_load

    if z < 1.0:
        return None

    # Check if sleep recovery is also poor
    poor_recovery = False
    if sleep_records:
        last_quality = sleep_records[0].get("quality_score")
        if last_quality is not None and last_quality < 6:
            poor_recovery = True

    severity = min(1.0, z / 3)
    if poor_recovery:
        severity = min(1.0, severity + 0.2)

    confidence = min(0.90, 0.65 + severity * 0.25)

    return Signal(
        signal_type=SignalType.RECOVERY_NEEDED,
        confidence=confidence,
        severity=severity,
        data={
            "today_calories_burned": round(today_load),
            "mean_daily_calories": round(float(mean_load)),
            "z_score": round(z, 2),
            "poor_recovery_sleep": poor_recovery,
        },
        reasoning=(
            f"Today's activity load ({today_load:.0f} kcal) is {z:.1f} standard deviations "
            f"above your 14-day average ({mean_load:.0f} kcal)."
            + (" Recovery sleep was also poor." if poor_recovery else "")
        ),
    )


def detect_dehydration(meals_today: List[Dict], activities_24h: List[Dict]) -> Optional[Signal]:
    """
    Estimate dehydration risk from logged water intake and activity sweat loss.
    Only triggers when water_ml data is actually present.
    """
    water_entries = [m.get("water_ml") or 0 for m in meals_today]
    if not any(w > 0 for w in water_entries):
        # No water data logged — can't make a meaningful call
        return None

    total_water_ml = sum(water_entries)

    # Adjust target upward for heavy activity
    activity_minutes = sum(a.get("duration_minutes") or 0 for a in activities_24h)
    target_ml = 2000 + activity_minutes * 8  # ~8 ml extra per active minute

    deficit_ratio = max(0.0, (target_ml - total_water_ml) / target_ml)

    if deficit_ratio < 0.35:
        return None

    severity = min(1.0, deficit_ratio)
    confidence = min(0.85, 0.60 + severity * 0.25)

    return Signal(
        signal_type=SignalType.DEHYDRATION,
        confidence=confidence,
        severity=severity,
        data={
            "water_logged_ml": round(total_water_ml),
            "estimated_target_ml": round(target_ml),
            "deficit_pct": round(deficit_ratio * 100),
        },
        reasoning=(
            f"You have logged {total_water_ml:.0f} ml of water today against an estimated "
            f"target of {target_ml:.0f} ml ({deficit_ratio * 100:.0f}% deficit)."
        ),
    )


def detect_anomaly(
    sleep_records: List[Dict],
    activities: List[Dict],
    meals: List[Dict],
) -> Optional[Signal]:
    """
    Use sklearn IsolationForest on a 4-feature daily wellness matrix
    [sleep_duration, sleep_quality, meal_calories, activity_calories] to
    detect days that are anomalous relative to the 14-day baseline.

    Requires MIN_SAMPLES_FOR_PREDICTION days of data.
    """
    try:
        from sklearn.ensemble import IsolationForest
        from sklearn.preprocessing import StandardScaler
    except ImportError:
        logger.warning("scikit-learn not available — skipping anomaly detection")
        return None

    # Build per-day feature matrix
    all_dates = set()
    for r in sleep_records:
        all_dates.add(_to_utc(r["sleep_start"]).date())
    for a in activities:
        all_dates.add(_to_utc(a["start_time"]).date())
    for m in meals:
        all_dates.add(_to_utc(m["meal_time"]).date())

    if len(all_dates) < settings.MIN_SAMPLES_FOR_PREDICTION:
        return None

    def day_features(d) -> List[float]:
        s = [r for r in sleep_records if _to_utc(r["sleep_start"]).date() == d]
        a = [x for x in activities if _to_utc(x["start_time"]).date() == d]
        m = [x for x in meals if _to_utc(x["meal_time"]).date() == d]
        return [
            float(s[0]["duration_minutes"]) if s and s[0].get("duration_minutes") else 420.0,
            float(s[0]["quality_score"]) if s and s[0].get("quality_score") else 7.0,
            float(sum(x.get("calories") or 0 for x in m)),
            float(sum(x.get("calories_burned") or 0 for x in a)),
        ]

    sorted_dates = sorted(all_dates)
    X = np.array([day_features(d) for d in sorted_dates])

    if X.shape[0] < settings.MIN_SAMPLES_FOR_PREDICTION:
        return None

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    clf = IsolationForest(contamination=0.1, random_state=42)
    clf.fit(X_scaled)

    # Score today (last row) — more negative = more anomalous
    today_score = clf.score_samples(X_scaled[[-1]])[0]
    today_pred = clf.predict(X_scaled[[-1]])[0]  # -1 = anomaly

    if today_pred != -1:
        return None

    # Anomaly score → severity (score ranges roughly -0.7 to +0.5)
    severity = min(1.0, max(0.0, (-today_score - 0.1) / 0.5))
    if severity < 0.3:
        return None

    return Signal(
        signal_type=SignalType.STRESS_HIGH,
        confidence=min(0.82, 0.60 + severity * 0.22),
        severity=severity,
        data={
            "anomaly_score": round(float(today_score), 3),
            "features": ["sleep_duration", "sleep_quality", "meal_calories", "activity_calories"],
        },
        reasoning=(
            f"Today's wellness profile is statistically anomalous "
            f"(isolation score: {today_score:.3f}) compared to your 14-day baseline."
        ),
    )


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def pick_strongest_signal(signals: List[Optional[Signal]]) -> Optional[Signal]:
    """Return the signal with the highest severity × confidence product."""
    candidates = [s for s in signals if s is not None]
    if not candidates:
        return None
    return max(candidates, key=lambda s: s.severity * s.confidence)


def detect_signals(
    meals: List[Dict],
    sleep_records: List[Dict],
    activities: List[Dict],
    now: datetime,
) -> Optional[Signal]:
    """
    Run all detectors and return the single most important signal.

    Data expectations:
      - meals: sorted desc by meal_time, covering PATTERN_DETECTION_WINDOW_DAYS
      - sleep_records: sorted desc by sleep_start, same window
      - activities: sorted desc by start_time, same window
    """
    from datetime import timedelta

    meals_today = [
        m for m in meals
        if _hours_ago(_to_utc(m["meal_time"]), now) <= 24
    ]
    activities_24h = [
        a for a in activities
        if _hours_ago(_to_utc(a["start_time"]), now) <= 24
    ]

    signals = [
        detect_meal_gap(meals, now),
        detect_poor_sleep(sleep_records, now),
        detect_low_energy(sleep_records, activities_24h, now),
        detect_recovery_needed(activities, sleep_records, now),
        detect_dehydration(meals_today, activities_24h),
        detect_anomaly(sleep_records, activities, meals),
    ]

    chosen = pick_strongest_signal(signals)
    if chosen:
        detected = [s.type for s in signals if s is not None]
        logger.info(f"Signals detected: {detected}. Chose: {chosen.type} (sev={chosen.severity:.2f}, conf={chosen.confidence:.2f})")
    else:
        logger.info("No signals detected above threshold.")

    return chosen
