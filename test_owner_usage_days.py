import os
import unittest
from unittest.mock import Mock, patch

from fastapi import HTTPException
from fastapi.testclient import TestClient

import account_auth as auth
from main import app


class OwnerUsageDaysTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        self.owner = '00000000-0000-0000-0000-000000000001'

    def test_guests_and_nonowners_cannot_read_report(self):
        with patch.object(auth, 'rpc') as rpc:
            self.assertEqual(self.client.get('/auth/admin/usage-days').status_code, 401)
            rpc.assert_not_called()
        for account in ({'id': 'another-account'}, {'id': self.owner, 'must_change_password': True}):
            with patch.object(auth, 'session_user', return_value=account), \
                 patch.dict(os.environ, {'OWNER_ACCOUNT_ID': self.owner}), patch.object(auth, 'rpc') as rpc:
                response = self.client.get('/auth/admin/usage-days')
                self.assertEqual(response.status_code, 403)
                self.assertEqual(response.headers['cache-control'], 'no-store')
                rpc.assert_not_called()

    def test_owner_search_and_pagination(self):
        report = {'accounts': [{'fps_id': '1234567', 'days_used': 0, 'last_used': None}], 'matching_accounts': 1}
        with patch.object(auth, 'session_user', return_value={'id': self.owner}), \
             patch.dict(os.environ, {'OWNER_ACCOUNT_ID': self.owner}), \
             patch.object(auth, 'rpc', return_value=report) as rpc:
            response = self.client.get('/auth/admin/usage-days', params={'page': 2, 'search': '+91 99999-99999'})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json(), report)
            self.assertEqual(response.headers['cache-control'], 'no-store')
            rpc.assert_called_once_with('usage_days', {'offset': 50, 'search': '919999999999'})
            for query in ('page=0', 'page=100001', 'search=%25', 'search=' + '1' * 31):
                rpc.reset_mock()
                self.assertEqual(self.client.get('/auth/admin/usage-days?' + query).status_code, 400)
                rpc.assert_not_called()

    def test_missing_database_report_fails_safely(self):
        with patch.object(auth, 'session_user', return_value={'id': self.owner}), \
             patch.dict(os.environ, {'OWNER_ACCOUNT_ID': self.owner}), \
             patch.object(auth, 'rpc', side_effect=HTTPException(503, 'Account service is temporarily unavailable.')):
            self.assertEqual(self.client.get('/auth/admin/usage-days').status_code, 503)

    def test_report_uses_separate_readonly_rpc(self):
        response = Mock()
        response.json.return_value = {'accounts': []}
        with patch.dict(os.environ, {'SUPABASE_URL': 'https://fixture.invalid', 'SUPABASE_SECRET_KEY': 'fixture-secret'}), \
             patch('account_auth.requests.post', return_value=response) as post:
            self.assertEqual(auth.rpc('usage_days', {'offset': 0, 'search': ''}), {'accounts': []})
            self.assertEqual(post.call_args.args[0], 'https://fixture.invalid/rest/v1/rpc/ration_usage_days')
            auth.rpc('recent_usage', {'offset': 0, 'search': ''})
            self.assertEqual(post.call_args.args[0], 'https://fixture.invalid/rest/v1/rpc/ration_recent_usage')

    def test_recent_usage_owner_security_search_and_pagination(self):
        with patch.object(auth, 'rpc') as rpc:
            self.assertEqual(self.client.get('/auth/admin/recent-usage').status_code, 401)
            rpc.assert_not_called()
        for account in ({'id': 'another-account'}, {'id': self.owner, 'must_change_password': True}):
            with patch.object(auth, 'session_user', return_value=account), \
                 patch.dict(os.environ, {'OWNER_ACCOUNT_ID': self.owner}), patch.object(auth, 'rpc') as rpc:
                self.assertEqual(self.client.get('/auth/admin/recent-usage').status_code, 403)
                rpc.assert_not_called()
        with patch.object(auth, 'session_user', return_value={'id': self.owner}), \
             patch.dict(os.environ, {'OWNER_ACCOUNT_ID': self.owner}), \
             patch.object(auth, 'rpc', return_value={'accounts': [], 'matching_accounts': 0}) as rpc:
            response = self.client.get('/auth/admin/recent-usage', params={'page': 3, 'search': '+91 99999-99999'})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.headers['cache-control'], 'no-store')
            rpc.assert_called_once_with('recent_usage', {'offset': 100, 'search': '919999999999'})
            for query in ('page=0', 'page=100001', 'search=%25', 'search=' + '1' * 31):
                rpc.reset_mock()
                self.assertEqual(self.client.get('/auth/admin/recent-usage?' + query).status_code, 400)
                rpc.assert_not_called()


if __name__ == '__main__':
    unittest.main()
