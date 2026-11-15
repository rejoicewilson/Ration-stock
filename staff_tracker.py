"""Private attendance and manual salary records; amounts are integer paise."""
import calendar
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field, model_validator
import account_auth as auth

router = APIRouter(prefix='/staff')


def today_ist():
    return datetime.now(timezone(timedelta(hours=5, minutes=30))).date()


def period_for(day, cycle):
    if cycle == 'daily':
        return day, day
    if cycle == 'weekly':
        start = day - timedelta(days=day.weekday())
        return start, start + timedelta(days=6)
    return day.replace(day=1), day.replace(day=calendar.monthrange(day.year, day.month)[1])


def dates(start, end):
    return [start + timedelta(days=i) for i in range(max(0, (end - start).days + 1))]


def paise(value):
    return int(Decimal(value).quantize(Decimal('1'), rounding=ROUND_HALF_UP))


def daily_balance(person, attendance, payments, today, totals=None):
    joined = date.fromisoformat(person['start_date'])
    if totals is None:
        rows = [a for a in attendance if joined <= date.fromisoformat(a['work_date']) <= today]
        totals = {
            'earned_units': sum({'present': 2, 'half_day': 1, 'paid_leave': 2}.get(a['status'], 0) for a in rows),
            'absent_units': sum({'absent': 2, 'half_day': 1}.get(a['status'], 0) for a in rows),
            'extra_paise': sum(a['extra_paise'] for a in rows if a['status'] == 'holiday_work'),
            'paid_paise': sum(p['amount_paise'] for p in payments if not p.get('voided')
                              and date.fromisoformat(p.get('paid_on', p['period_start'])) <= today),
            'marked_days': sum(a['status'] != 'holiday_work' for a in rows),
            **{key: sum(a['status'] == status for a in rows) for key, status in
               [('present_days', 'present'), ('half_days', 'half_day'), ('absent_days', 'absent'), ('paid_leave_days', 'paid_leave')]},
        }
    working_days = sum(d.weekday() != 6 for d in dates(joined, today))
    earned = paise(Decimal(person['rate_paise']) * totals['earned_units'] / 2) + totals['extra_paise']
    return {
        'balance_scope': 'all_time', 'as_of': today.isoformat(),
        'period_start': joined.isoformat(), 'period_end': today.isoformat(),
        'pending_days': max(0, working_days - totals['marked_days']), 'future_days': 0,
        'scheduled_days': working_days, 'eligible_days': working_days,
        'planned_paise': working_days * person['rate_paise'],
        'deduction_paise': paise(Decimal(person['rate_paise']) * totals['absent_units'] / 2),
        'earned_paise': earned, 'paid_paise': totals['paid_paise'],
        'balance_paise': earned - totals['paid_paise'], 'extra_paise': totals['extra_paise'],
        **{key: totals[key] for key in ('present_days', 'half_days', 'absent_days', 'paid_leave_days')},
        'attendance': sorted(attendance, key=lambda a: a['work_date'], reverse=True), 'payments': payments,
    }


def salary_summary(person, attendance, payments, selected, today=None, running_totals=None):
    today = today or today_ist()
    if person['pay_cycle'] == 'daily':
        return daily_balance(person, attendance, payments, today, running_totals)
    start, end = period_for(selected, person['pay_cycle'])
    joined = date.fromisoformat(person['start_date'])
    scheduled = [d for d in dates(start, end) if d.weekday() != 6]
    eligible = [d for d in scheduled if d >= joined]
    elapsed = [d for d in eligible if d <= today]
    records = {a['work_date']: a for a in attendance if start.isoformat() <= a['work_date'] <= end.isoformat()}
    units = {'present': 2, 'half_day': 1, 'paid_leave': 2, 'absent': 0}
    earned_units = sum(units.get(records.get(d.isoformat(), {}).get('status'), 0) for d in elapsed)
    absent_units = sum(2 if records.get(d.isoformat(), {}).get('status') == 'absent' else
                       1 if records.get(d.isoformat(), {}).get('status') == 'half_day' else 0 for d in elapsed)
    divisor = 1 if person['pay_cycle'] == 'daily' else len(scheduled)
    rate = Decimal(person['rate_paise']) / max(1, divisor)
    extra = sum(a['extra_paise'] for a in records.values() if a['status'] == 'holiday_work'
                and joined <= date.fromisoformat(a['work_date']) <= today)
    earned = paise(rate * earned_units / 2) + extra
    period_payments = [p for p in payments if p['period_start'] == start.isoformat()]
    paid = sum(p['amount_paise'] for p in period_payments if not p.get('voided'))
    return {
        'period_start': start.isoformat(), 'period_end': end.isoformat(),
        'scheduled_days': len(scheduled), 'eligible_days': len(eligible),
        'pending_days': sum(d.isoformat() not in records for d in elapsed),
        'future_days': sum(d > today for d in eligible),
        'present_days': sum(a['status'] == 'present' for a in records.values()),
        'half_days': sum(a['status'] == 'half_day' for a in records.values()),
        'absent_days': sum(a['status'] == 'absent' for a in records.values()),
        'paid_leave_days': sum(a['status'] == 'paid_leave' for a in records.values()),
        'planned_paise': paise(rate * len(eligible)), 'earned_paise': earned,
        'deduction_paise': paise(rate * absent_units / 2), 'extra_paise': extra,
        'paid_paise': paid, 'balance_paise': earned - paid,
        'attendance': sorted(records.values(), key=lambda a: a['work_date'], reverse=True),
        'payments': period_payments,
    }


class Body(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)


class ReportBody(Body):
    day: date


class CreateBody(Body):
    name: str = Field(min_length=1, max_length=80)
    pay_cycle: Literal['daily'] = 'daily'
    rate_paise: int = Field(ge=1, le=100000000, strict=True)
    start_date: date
    request_id: UUID


class MutationBody(Body):
    staff_id: UUID
    expected_revision: int = Field(ge=0, strict=True)
    request_id: UUID


class AttendanceBody(MutationBody):
    work_date: date
    status: Literal['present', 'half_day', 'absent', 'paid_leave', 'holiday_work', 'unmarked']
    extra_paise: int = Field(default=0, ge=0, le=100000000, strict=True)

    @model_validator(mode='after')
    def valid_day(self):
        if self.work_date > today_ist():
            raise ValueError('Future attendance is not allowed')
        if self.status == 'holiday_work':
            if self.work_date.weekday() != 6 or self.extra_paise <= 0:
                raise ValueError('Holiday work requires Sunday and extra pay')
        elif self.extra_paise or (self.work_date.weekday() == 6 and self.status != 'unmarked'):
            raise ValueError('Sunday is a holiday')
        return self


class PaymentBody(MutationBody):
    period_start: date | None = None  # Required only for legacy weekly/monthly staff.
    paid_on: date
    kind: Literal['salary', 'advance']
    amount_paise: int = Field(ge=1, le=100000000, strict=True)
    note: str = Field(default='', max_length=200)

    @model_validator(mode='after')
    def valid_day(self):
        if self.paid_on > today_ist():
            raise ValueError('Future payments are not allowed')
        return self


class VoidBody(MutationBody):
    payment_id: UUID


def execute(request, action, body):
    data = {**body.model_dump(mode='json'), 'account_id': request.state.account['id']}
    result = auth.rpc('staff_' + action, data)
    errors = {
        'not_found': (404, 'Staff member or payment not found.'),
        'conflict': (409, 'This record changed. Refresh and check before saving again.'),
        'request_conflict': (409, 'This save request was already used for different details.'),
        'invalid': (400, 'Check the dates, attendance and payment details.'),
        'limit': (400, 'You can add up to 50 staff members.'),
        'unauthorized': (401, 'Please sign in again to continue.'),
    }
    if not isinstance(result, dict):
        raise HTTPException(503, 'Staff records are temporarily unavailable.')
    if result.get('error'):
        status, message = errors.get(result['error'], (503, 'Staff records are temporarily unavailable.'))
        raise HTTPException(status, message)
    return result


@router.post('/report')
def report(body: ReportBody, request: Request):
    result = execute(request, 'report', body)
    for person in result['staff']:
        totals = person.pop('daily_totals', None)
        if person['pay_cycle'] == 'daily' and not isinstance(totals, dict):
            # Never label the old date-filtered report as an all-time balance.
            raise HTTPException(503, 'Staff balance update is not installed yet.')
        person['summary'] = salary_summary(person, person.pop('attendance'), person.pop('payments'), body.day,
                                          running_totals=totals)
    return {**result, 'today': today_ist().isoformat()}


@router.post('/create')
def create(body: CreateBody, request: Request):
    return execute(request, 'create', body)


@router.post('/attendance')
def attendance(body: AttendanceBody, request: Request):
    return execute(request, 'attendance', body)


@router.post('/payment')
def payment(body: PaymentBody, request: Request):
    return execute(request, 'payment', body)


@router.post('/void-payment')
def void_payment(body: VoidBody, request: Request):
    return execute(request, 'void', body)
