import unittest
from unittest.mock import Mock, patch

import requests
from fastapi import HTTPException
from fastapi.testclient import TestClient

import account_auth as auth
from main import app, StockRequest, StockRegisterRequest, get_raw_rice_cb_sum, get_stock_register


def report(quantity):
    return '<table id="Report"><tr><th>Stock report</th></tr><tr><th>Columns</th></tr><tr>' + ''.join(
        '<td>' + str(value) + '</td>' for value in [1, 'RAW RICE', 'KG', 0, 0, 0, 0, 0, 0, 0, quantity]) + '</tr></table>'


class StockFreshnessTests(unittest.TestCase):
    def setUp(self):
        self.request = StockRequest(fps_id=1234567, month=11, year=2026)

    def response(self, html):
        return Mock(text=html, status_code=200)

    def test_each_request_fetches_upstream_without_cache(self):
        with patch('main.requests.post', side_effect=[self.response(report(v)) for v in (70, 70, 50, 50)]) as post:
            first = get_raw_rice_cb_sum(self.request)
            second = get_raw_rice_cb_sum(self.request)
        self.assertEqual(first['RAW_RICE_cb_sum'], '70.0 kg')
        self.assertEqual(second['RAW_RICE_cb_sum'], '50.0 kg')
        self.assertEqual(post.call_count, 4)
        self.assertTrue(first['consistency_checked'])
        self.assertNotIn('_stock_fingerprint', first)
        for call in post.call_args_list:
            self.assertIn('no-store', call.kwargs['headers']['Cache-Control'])
            self.assertEqual(call.kwargs['headers']['Pragma'], 'no-cache')
        self.assertEqual(second['requested_period'], {'fps_id': '1234567', 'month': 11, 'year': 2026})
        self.assertTrue(second['fetched_at'].endswith('+00:00'))

    def test_missing_empty_or_malformed_report_fails_not_zero_fallback(self):
        for html in ('<html>Maintenance</html>', '<table id="Report"><tr><th>Empty</th></tr></table>',
                     report('bad'), report('NaN'), report('Infinity')):
            with self.subTest(html=html), patch('main.requests.post', return_value=self.response(html)):
                with self.assertRaises(HTTPException):
                    get_raw_rice_cb_sum(self.request)

    def test_real_zero_is_valid_and_network_failure_has_no_old_result(self):
        with patch('main.requests.post', side_effect=[self.response(report(0)), self.response(report(0)), requests.Timeout()]):
            self.assertEqual(get_raw_rice_cb_sum(self.request)['RAW_RICE_cb_sum'], '0.0 kg')
            with self.assertRaises(HTTPException):
                get_raw_rice_cb_sum(self.request)

    def test_protected_http_result_is_no_store(self):
        client = TestClient(app)
        client.headers['origin'] = auth.ALLOWED_ORIGINS[0]
        client.cookies.set(auth.SESSION_COOKIE, 'A' * 43)
        with patch('account_auth.session_user', return_value={'id': 'test'}), \
             patch('account_auth.account_plan', return_value={'access_allowed': True}), \
             patch('account_auth.rpc', return_value={'ok': True}), \
             patch('main.requests.post', return_value=self.response(report(70))):
            response = client.post('/count', json=self.request.model_dump())
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers['cache-control'], 'no-store')

    def test_conflicting_reports_are_not_returned_in_either_order(self):
        for quantities in ((311, 533), (533, 311)):
            with patch('main.requests.post', side_effect=[self.response(report(v)) for v in quantities]):
                with self.assertRaises(HTTPException) as error:
                    get_raw_rice_cb_sum(self.request)
            self.assertEqual(error.exception.status_code, 503)
            self.assertEqual(error.exception.detail['code'], 'STOCK_INCONSISTENT')
            self.assertNotIn('311', str(error.exception.detail))

    def test_same_total_but_different_report_details_are_rejected(self):
        original = report(70)
        changed = original.replace('<td>KG</td><td>0</td>', '<td>KG</td><td>100</td>')
        with patch('main.requests.post', side_effect=[self.response(original), self.response(changed)]):
            with self.assertRaises(HTTPException) as error:
                get_raw_rice_cb_sum(self.request)
        self.assertEqual(error.exception.detail['code'], 'STOCK_INCONSISTENT')


class StockBoardFreshnessTests(unittest.TestCase):
    def setUp(self):
        self.request = StockRegisterRequest(fps_id=1842187, dist_code=18, office_code=42, month=11, year=2026)

    def response(self, quantity):
        cells = [1, 'NPS', 'RAW RICE', 'KG', 0, 0, 0, 0, 0, 0, 0, quantity]
        html = '<table><tr>' + ''.join('<td>' + str(v) + '</td>' for v in cells) + '</tr></table>'
        return Mock(text=html, status_code=200)

    def test_each_board_submission_fetches_new_report(self):
        sessions = [requests.Session() for _ in range(4)]
        for session, quantity in zip(sessions, [70, 70, 50, 50]):
            session.post = Mock(return_value=self.response(quantity))
        with patch('main.requests.Session', side_effect=sessions) as factory, \
             patch('main.get_fps_dealer_name', return_value='Test dealer'):
            first = get_stock_register(self.request)
            second = get_stock_register(self.request)
        self.assertEqual(first['tables'][0]['records'][0]['CB Qty'], '70')
        self.assertEqual(second['tables'][0]['records'][0]['CB Qty'], '50')
        self.assertEqual(factory.call_count, 4)
        self.assertIsNot(sessions[0].cookies, sessions[1].cookies)
        for session in sessions:
            session.post.assert_called_once()
            call = session.post.call_args
            self.assertIn('no-store', call.kwargs['headers']['Cache-Control'])
        self.assertEqual(second['requested_period']['fps_id'], '1842187')
        self.assertEqual(second['requested_period']['office_code'], 42)
        self.assertTrue(second['fetched_at'].endswith('+00:00'))
        self.assertTrue(second['consistency_checked'])
        self.assertNotIn('_stock_fingerprint', second)

    def test_conflicting_board_reports_fail_without_choosing_lower_stock(self):
        sessions = [requests.Session(), requests.Session()]
        for session, quantity in zip(sessions, [533, 311]):
            session.post = Mock(return_value=self.response(quantity))
        with patch('main.requests.Session', side_effect=sessions), \
             patch('main.get_fps_dealer_name') as dealer:
            with self.assertRaises(HTTPException) as error:
                get_stock_register(self.request)
        self.assertEqual(error.exception.detail['code'], 'STOCK_INCONSISTENT')
        dealer.assert_not_called()

    def test_empty_and_invalid_board_reports_fail_without_zero_board(self):
        for response in [Mock(text='<html>Unavailable</html>', status_code=200),
                         self.response('NaN'), self.response('bad')]:
            session = requests.Session()
            session.post = Mock(return_value=response)
            with patch('main.requests.Session', return_value=session), self.assertRaises(HTTPException):
                get_stock_register(self.request)

    def test_actual_zero_valid_and_failure_has_no_previous_board(self):
        session = requests.Session()
        session.post = Mock(side_effect=[self.response(0), self.response(0), requests.Timeout()])
        with patch('main.requests.Session', return_value=session), \
             patch('main.get_fps_dealer_name', return_value=''):
            self.assertEqual(get_stock_register(self.request)['tables'][0]['records'][0]['CB Qty'], '0')
            with self.assertRaises(HTTPException):
                get_stock_register(self.request)

    def test_previous_upstream_session_cannot_change_new_report(self):
        # Emulate the observed upstream bug: a reused report cookie returns old stock.
        sessions = []
        def fresh_session():
            session = Mock()
            session.headers = {}
            session.cookies = {}
            def fetch(*args, **kwargs):
                quantity = 533 if session.cookies else 311
                session.cookies['report_state'] = 'used'
                return self.response(quantity)
            session.post.side_effect = fetch
            from unittest.mock import MagicMock
            context = MagicMock()
            context.__enter__.return_value = session
            sessions.append(session)
            return context
        with patch('main.requests.Session', side_effect=fresh_session), \
             patch('main.EPOS_SESSION.post', side_effect=AssertionError('Shared ePoS session must not fetch stock')), \
             patch('main.get_fps_dealer_name', return_value=''):
            for month in (11, 10, 11):
                request = self.request.model_copy(update={'month': month})
                self.assertEqual(get_stock_register(request)['tables'][0]['records'][0]['CB Qty'], '311')
        self.assertEqual(len(sessions), 6)
        self.assertEqual(len({id(s.cookies) for s in sessions}), 6)


if __name__ == '__main__':
    unittest.main()
