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
        with patch('main.requests.post', side_effect=[self.response(report(70)), self.response(report(50))]) as post:
            first = get_raw_rice_cb_sum(self.request)
            second = get_raw_rice_cb_sum(self.request)
        self.assertEqual(first['RAW_RICE_cb_sum'], '70.0 kg')
        self.assertEqual(second['RAW_RICE_cb_sum'], '50.0 kg')
        self.assertEqual(post.call_count, 2)
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
        with patch('main.requests.post', side_effect=[self.response(report(0)), requests.Timeout()]):
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


class StockBoardFreshnessTests(unittest.TestCase):
    def setUp(self):
        self.request = StockRegisterRequest(fps_id=1842187, dist_code=18, office_code=42, month=11, year=2026)

    def response(self, quantity):
        cells = [1, 'NPS', 'RAW RICE', 'KG', 0, 0, 0, 0, 0, 0, 0, quantity]
        html = '<table><tr>' + ''.join('<td>' + str(v) + '</td>' for v in cells) + '</tr></table>'
        return Mock(text=html, status_code=200)

    def test_each_board_submission_fetches_new_report(self):
        with patch('main.EPOS_SESSION.post', side_effect=[self.response(70), self.response(50)]) as post, \
             patch('main.get_fps_dealer_name', return_value='Test dealer'):
            first = get_stock_register(self.request)
            second = get_stock_register(self.request)
        self.assertEqual(first['tables'][0]['records'][0]['CB Qty'], '70')
        self.assertEqual(second['tables'][0]['records'][0]['CB Qty'], '50')
        self.assertEqual(post.call_count, 2)
        for call in post.call_args_list:
            self.assertIn('no-store', call.kwargs['headers']['Cache-Control'])
        self.assertEqual(second['requested_period']['fps_id'], '1842187')
        self.assertEqual(second['requested_period']['office_code'], 42)
        self.assertTrue(second['fetched_at'].endswith('+00:00'))

    def test_empty_and_invalid_board_reports_fail_without_zero_board(self):
        for response in [Mock(text='<html>Unavailable</html>', status_code=200),
                         self.response('NaN'), self.response('bad')]:
            with patch('main.EPOS_SESSION.post', return_value=response), self.assertRaises(HTTPException):
                get_stock_register(self.request)

    def test_actual_zero_valid_and_failure_has_no_previous_board(self):
        with patch('main.EPOS_SESSION.post', side_effect=[self.response(0), requests.Timeout()]), \
             patch('main.get_fps_dealer_name', return_value=''):
            self.assertEqual(get_stock_register(self.request)['tables'][0]['records'][0]['CB Qty'], '0')
            with self.assertRaises(HTTPException):
                get_stock_register(self.request)


if __name__ == '__main__':
    unittest.main()
