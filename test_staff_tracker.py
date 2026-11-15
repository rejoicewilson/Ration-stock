import unittest
from datetime import date, timedelta
from unittest.mock import patch
from fastapi.testclient import TestClient
from pydantic import ValidationError
import account_auth as auth
from main import app
from staff_tracker import salary_summary, period_for, AttendanceBody


class SalaryTests(unittest.TestCase):
    def person(self, cycle='monthly', rate=2600000, start='2026-11-01'):
        return {'pay_cycle': cycle, 'rate_paise': rate, 'start_date': start}

    def entries(self, start, days, status='present'):
        return [{'work_date': (start + timedelta(days=i)).isoformat(), 'status': status, 'extra_paise': 0}
                for i in range(days) if (start + timedelta(days=i)).weekday() != 6]

    def test_monthly_full_month_and_sunday_no_deduction(self):
        s = salary_summary(self.person(), self.entries(date(2026, 11, 1), 30), [], date(2026, 11, 14), date(2026, 12, 1))
        self.assertEqual(s['scheduled_days'], 25)
        self.assertEqual(s['earned_paise'], 2600000)
        self.assertEqual(s['deduction_paise'], 0)
        self.assertEqual(s['pending_days'], 0)

    def test_absence_half_day_and_paid_leave(self):
        entries = self.entries(date(2026, 11, 2), 6)
        entries[0]['status'] = 'absent'
        entries[1]['status'] = 'half_day'
        entries[2]['status'] = 'paid_leave'
        s = salary_summary(self.person('weekly', 300000), entries, [], date(2026, 11, 8), date(2026, 11, 8))
        self.assertEqual(s['earned_paise'], 225000)
        self.assertEqual(s['deduction_paise'], 75000)
        self.assertEqual(s['paid_leave_days'], 1)

    def test_unmarked_future_and_join_date_are_distinct(self):
        s = salary_summary(self.person('weekly', 300000, '2026-11-04'), [], [], date(2026, 11, 4), date(2026, 11, 4))
        self.assertEqual(s['planned_paise'], 200000)
        self.assertEqual(s['earned_paise'], 0)
        self.assertEqual(s['pending_days'], 1)
        self.assertEqual(s['future_days'], 3)
        self.assertEqual(s['deduction_paise'], 0)

    def test_daily_holiday_extra_and_payment_corrections(self):
        rows = [{'work_date': '2026-11-08', 'status': 'holiday_work', 'extra_paise': 70000}]
        payments = [{'period_start': '2026-11-08', 'amount_paise': 80000, 'voided': False},
                    {'period_start': '2026-11-08', 'amount_paise': 30000, 'voided': True},
                    {'period_start': '2026-11-07', 'amount_paise': 99999, 'voided': False}]
        s = salary_summary(self.person('daily', 60000), rows, payments, date(2026, 11, 8), date(2026, 11, 8))
        self.assertEqual(s['balance_scope'], 'all_time')
        self.assertEqual(s['earned_paise'], 70000)
        self.assertEqual(s['balance_paise'], -109999)
        self.assertEqual(len(s['payments']), 3)

    def test_daily_wage_statuses(self):
        for status, earned in [('present', 50000), ('half_day', 25000), ('absent', 0), ('paid_leave', 50000)]:
            rows = [{'work_date': '2026-11-14', 'status': status, 'extra_paise': 0}]
            summary = salary_summary(self.person('daily', 50000, '2026-11-14'), rows, [], date(2026, 11, 14), date(2026, 11, 14))
            self.assertEqual(summary['earned_paise'], earned)
            self.assertEqual(summary['pending_days'], 0)

    def test_running_balance_accepts_payment_after_several_days(self):
        person = self.person('daily', 50000, '2026-10-26')
        attendance = self.entries(date(2026, 10, 26), 8)
        self.assertEqual(len(attendance), 7)
        payments = [{'paid_on': '2026-11-02', 'period_start': '2026-11-02', 'amount_paise': 200000}]
        for selected in [date(2026, 10, 26), date(2026, 11, 2)]:
            s = salary_summary(person, attendance, payments, selected, date(2026, 11, 3))
            self.assertEqual(s['earned_paise'], 350000)
            self.assertEqual(s['paid_paise'], 200000)
            self.assertEqual(s['balance_paise'], 150000)
        payments.append({'paid_on': '2026-11-03', 'period_start': '2026-11-03', 'amount_paise': 150000})
        self.assertEqual(salary_summary(person, attendance, payments, selected, date(2026, 11, 3))['balance_paise'], 0)
        payments[-1]['voided'] = True
        self.assertEqual(salary_summary(person, attendance, payments, selected, date(2026, 11, 3))['balance_paise'], 150000)

    def test_database_totals_independent_of_history_month(self):
        totals = dict(earned_units=14, absent_units=0, extra_paise=10000, paid_paise=200000,
                      marked_days=7, present_days=7, half_days=0, absent_days=0, paid_leave_days=0)
        s = salary_summary(self.person('daily', 50000), [], [], date(2026, 11, 1), date(2026, 11, 15), totals)
        self.assertEqual(s['balance_paise'], 160000)
        self.assertEqual(s['attendance'], [])

    def test_rounding_once_not_per_day_and_leap_periods(self):
        start, end = period_for(date(2024, 2, 29), 'monthly')
        s = salary_summary(self.person('monthly', 100001, '2024-02-01'), self.entries(start, 29), [], end, end)
        self.assertEqual(s['earned_paise'], 100001)
        self.assertEqual(end, date(2024, 2, 29))
        self.assertEqual(period_for(date(2027, 1, 1), 'weekly'), (date(2026, 12, 28), date(2027, 1, 3)))

    def test_sunday_and_future_attendance_validation(self):
        base = {'staff_id': '00000000-0000-0000-0000-000000000001', 'request_id': '00000000-0000-0000-0000-000000000002', 'expected_revision': 0}
        with patch('staff_tracker.today_ist', return_value=date(2026, 11, 14)):
            for day, status, extra in [('2026-11-08', 'absent', 0), ('2026-11-09', 'holiday_work', 100),
                                       ('2026-11-08', 'holiday_work', 0), ('2026-11-15', 'holiday_work', 100)]:
                with self.subTest(day=day, status=status), self.assertRaises(ValidationError):
                    AttendanceBody(**base, work_date=day, status=status, extra_paise=extra)


class StaffApiTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        self.client.headers['origin'] = auth.ALLOWED_ORIGINS[0]
        self.client.cookies.set(auth.SESSION_COOKIE, 'A' * 43)
        self.owner = '00000000-0000-0000-0000-000000000001'
        self.patcher = patch('account_auth.rpc')
        self.rpc = self.patcher.start()
        self.addCleanup(self.patcher.stop)
        self.rpc.side_effect = lambda action, data: {'id': self.owner} if action == 'session' else {'ok': True}
        self.plan = patch('account_auth.account_plan', return_value={'access_allowed': True})
        self.plan.start()
        self.addCleanup(self.plan.stop)
        self.body = {'name': 'Private person', 'pay_cycle': 'daily', 'rate_paise': 50000,
                     'start_date': '2026-11-01', 'request_id': '00000000-0000-0000-0000-000000000002'}

    def test_all_endpoints_protected_and_uncached(self):
        paths = ('report', 'create', 'attendance', 'payment', 'void-payment')
        self.client.cookies.clear()
        for path in paths:
            r = self.client.post('/staff/' + path, json={})
            self.assertEqual(r.status_code, 401)
            self.assertEqual(r.headers['cache-control'], 'no-store')
        self.client.cookies.set(auth.SESSION_COOKIE, 'A' * 43)
        with patch('account_auth.account_plan', return_value={'access_allowed': False}):
            for path in paths:
                self.assertEqual(self.client.post('/staff/' + path, json={}).status_code, 402)

    def test_identity_and_private_validation(self):
        r = self.client.post('/staff/create', json=self.body)
        self.assertEqual(r.status_code, 200)
        saved = next(c.args[1] for c in self.rpc.call_args_list if c.args[0] == 'staff_create')
        self.assertEqual(saved['account_id'], self.owner)
        for c in self.rpc.call_args_list:
            if c.args[0] == 'record_activity':
                self.assertNotIn('Private person', str(c.args[1]))
        r = self.client.post('/staff/create', json={**self.body, 'account_id': self.owner})
        self.assertEqual(r.status_code, 422)
        self.assertNotIn('Private person', r.text)
        self.assertEqual(self.client.post('/staff/create', json=self.body, headers={'origin': 'https://evil.test'}).status_code, 403)

    def test_conflict_and_temporary_password(self):
        self.rpc.side_effect = lambda action, data: {'id': self.owner} if action == 'session' else {'error': 'conflict'}
        self.assertEqual(self.client.post('/staff/create', json=self.body).status_code, 409)
        self.rpc.side_effect = lambda action, data: {'id': self.owner, 'must_change_password': True}
        self.assertEqual(self.client.post('/staff/create', json=self.body).status_code, 403)

    def test_only_daily_staff_can_be_created(self):
        for cycle in ('weekly', 'monthly'):
            self.rpc.reset_mock()
            response = self.client.post('/staff/create', json={**self.body, 'pay_cycle': cycle})
            self.assertEqual(response.status_code, 422)
            self.assertFalse(any(c.args[0] == 'staff_create' for c in self.rpc.call_args_list))
        body = {k: v for k, v in self.body.items() if k != 'pay_cycle'}
        self.assertEqual(self.client.post('/staff/create', json=body).status_code, 200)
        saved = next(c.args[1] for c in self.rpc.call_args_list if c.args[0] == 'staff_create')
        self.assertEqual(saved['pay_cycle'], 'daily')

    def test_daily_report_requires_all_time_database_totals(self):
        person = {'id': self.owner, 'name': 'Test', 'pay_cycle': 'daily', 'rate_paise': 50000,
                  'start_date': '2026-11-01', 'attendance': [], 'payments': []}
        def rpc(action, data):
            return {'id': self.owner} if action == 'session' else {'staff': [dict(person)]} if action == 'staff_report' else {'ok': True}
        self.rpc.side_effect = rpc
        self.assertEqual(self.client.post('/staff/report', json={'day': '2026-11-01'}).status_code, 503)
        person['daily_totals'] = dict(earned_units=14, absent_units=0, extra_paise=0, paid_paise=200000,
                                     marked_days=7, present_days=7, half_days=0, absent_days=0, paid_leave_days=0)
        r = self.client.post('/staff/report', json={'day': '2026-11-01'})
        self.assertEqual(r.status_code, 200)
        summary = r.json()['staff'][0]['summary']
        self.assertEqual(summary['balance_scope'], 'all_time')
        self.assertEqual(summary['balance_paise'], 150000)

    def test_rpc_dispatch(self):
        self.patcher.stop()
        with patch('account_auth.requests.post') as post:
            post.return_value.json.return_value = {'staff': []}
            with patch.dict('os.environ', {'SUPABASE_URL': 'https://example.test', 'SUPABASE_SECRET_KEY': 'fixture-key'}):
                auth.rpc('staff_report', {'account_id': self.owner, 'day': '2026-11-14'})
            self.assertTrue(post.call_args.args[0].endswith('/rpc/ration_staff'))
