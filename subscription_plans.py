"""Live plan eligibility shared by status reporting and feature enforcement."""
from datetime import datetime, timezone


DEFAULT_FREE_UNTIL = '2026-11-01T00:00:00+05:30'


def parse_instant(value):
    instant = datetime.fromisoformat(value)
    if instant.tzinfo is None or instant.utcoffset() is None:
        raise ValueError('A timezone is required')
    return instant.astimezone(timezone.utc)


def plan_status(paid_until, free_until, *, now=None, mode='live'):
    """Report a plan using exclusive expiry boundaries and timezone-aware time."""
    now = (now or datetime.now(timezone.utc)).astimezone(timezone.utc)
    free_expiry = parse_instant(free_until)
    paid_expiry = parse_instant(paid_until) if paid_until is not None else None
    paid_active = paid_expiry is not None and now < paid_expiry
    free_active = now < free_expiry
    if paid_active:
        plan = 'paid'
    elif free_active:
        plan = 'free'
    elif paid_expiry is not None:
        plan = 'expired'
    else:
        plan = 'inactive'
    return {
        'plan': plan,
        'mode': mode,
        'paid_active': paid_active,
        'paid_until': paid_expiry.isoformat() if paid_expiry else None,
        'free_access_active': free_active,
        'free_until': free_expiry.isoformat(),
        'access_allowed': paid_active or free_active,
        'enforcement_enabled': True,
        'price_paise': 9900,
        'duration_days': 30,
    }
