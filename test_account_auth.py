import unittest
import asyncio
from unittest.mock import patch
from fastapi import HTTPException
from fastapi.testclient import TestClient
from starlette.requests import Request
from starlette.responses import Response
import account_auth as auth
from main import app


class AccountSecurityTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        self.client.headers['origin'] = auth.ALLOWED_ORIGINS[0]
        self.mock = patch('account_auth.rpc')
        self.rpc = self.mock.start()
        self.addCleanup(self.mock.stop)

    def test_all_features_require_session(self):
        for path in auth.PROTECTED_PATHS:
            for suffix in ('', '/'):
                response = self.client.post(path + suffix, json={})
                self.assertEqual(response.status_code, 401, path)
                self.assertEqual(response.headers['cache-control'], 'no-store')
        self.rpc.assert_not_called()

    def test_untrusted_origin_blocked(self):
        response = self.client.post('/auth/login', headers={'origin': 'https://evil.example'}, json={})
        self.assertEqual(response.status_code, 403)
        self.rpc.assert_not_called()

    def test_validation_does_not_echo_password(self):
        response = self.client.post('/auth/register', json={'mobile': 'bad', 'password': 'private-secret', 'fps_id': 'bad'})
        self.assertEqual(response.status_code, 422)
        self.assertNotIn('private-secret', response.text)

    def test_register_hashes_password_and_sets_private_cookies(self):
        self.rpc.side_effect = lambda action, data: {'allowed': True} if action == 'limit' else {'ok': True}
        response = self.client.post('/auth/register', json={'mobile': '9447645196', 'password': 'my-long-test-password', 'fps_id': '1842187'})
        self.assertEqual(response.status_code, 200)
        data = self.rpc.call_args.args[1]
        self.assertTrue(auth.check_password('my-long-test-password', data['password_hash']))
        self.assertNotIn('password', data)
        self.assertEqual(len(data['session_hash']), 64)
        self.assertEqual(response.json(), {'ok': True})
        self.assertIn('HttpOnly', response.headers['set-cookie'])
        self.assertIn('SameSite=lax', response.headers['set-cookie'])

    def test_database_failure_does_not_grant_access(self):
        self.client.cookies.set(auth.SESSION_COOKIE, 'A' * 43)
        self.rpc.side_effect = HTTPException(503, 'Unavailable')
        self.assertEqual(self.client.post('/count', json={}).status_code, 503)

    def test_expired_session_denied(self):
        self.client.cookies.set(auth.SESSION_COOKIE, 'A' * 43)
        self.rpc.return_value = None
        self.assertEqual(self.client.get('/auth/me').status_code, 401)

    def test_temporary_password_blocks_features(self):
        self.client.cookies.set(auth.SESSION_COOKIE, 'A' * 43)
        self.rpc.return_value = {'id': 'test', 'must_change_password': True}
        self.assertEqual(self.client.post('/count', json={}).status_code, 403)

    def test_rate_limit_stops_login(self):
        self.rpc.return_value = {'allowed': False}
        response = self.client.post('/auth/login', json={'mobile': '9447645196', 'password': 'wrong'})
        self.assertEqual(response.status_code, 429)
        self.assertEqual(self.rpc.call_count, 1)

    def test_password_and_mobile_helpers(self):
        hashed = auth.hasher.hash('long test password')
        self.assertTrue(auth.check_password('long test password', hashed))
        self.assertFalse(auth.check_password('wrong', hashed))
        self.assertFalse(auth.check_password('wrong', None))
        self.assertEqual(auth.normalize_mobile('+91 9447645196'), '919447645196')

    def test_no_public_recovery_endpoint(self):
        self.assertEqual(self.client.post('/auth/reset-password', json={}).status_code, 404)

    def test_only_expected_account_routes_registered(self):
        routes = {route.path for route in app.routes if route.path.startswith('/auth/')}
        self.assertEqual(routes, {'/auth/me', '/auth/support', '/auth/register', '/auth/login',
            '/auth/logout', '/auth/devices', '/auth/change-password', '/auth/admin/dashboard', '/auth/admin/reset-password'})

    def test_owner_reset_security_and_password_hash(self):
        owner_id = '00000000-0000-0000-0000-000000000001'
        target_id = '00000000-0000-0000-0000-000000000002'
        password_hash = auth.hasher.hash('owner test password')
        owner = {'id': owner_id, 'mobile': '919999999999'}
        payload = {'account_id': target_id, 'mobile': '918888888888', 'owner_password': 'owner test password',
                   'temporary_password': 'member temporary phrase',
                   'reason': 'Verified independently by support', 'ownership_verified': True}
        def reply(action, data):
            if action == 'session': return owner
            if action == 'limit': return {'allowed': True}
            if action == 'find':
                return {'id': owner_id, 'password_hash': password_hash} if data['mobile'] == owner['mobile'] else {'id': target_id}
            return {'ok': True}
        self.rpc.side_effect = reply
        self.client.cookies.set(auth.SESSION_COOKIE, 'A' * 43)
        with patch.dict('os.environ', {'OWNER_ACCOUNT_ID': owner_id}):
            response = self.client.post('/auth/admin/reset-password', json=payload)
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.headers['cache-control'], 'no-store')
            self.assertEqual(response.json(), {'ok': True})
            temporary = payload['temporary_password']
            self.assertGreaterEqual(len(temporary), 12)
            action, data = self.rpc.call_args.args
            self.assertEqual(action, 'reset_password')
            self.assertTrue(auth.check_password(temporary, data['password_hash']))
            self.assertIn(owner_id, data['reason'])
            self.assertNotIn(temporary, data['reason'])
            invalid = self.client.post('/auth/admin/reset-password', json={**payload, 'temporary_password': 'short'})
            self.assertEqual(invalid.status_code, 422)
            self.assertNotIn('owner test password', invalid.text)
            self.assertEqual(self.client.post('/auth/admin/reset-password', json={**payload, 'temporary_password': payload['owner_password']}).status_code, 400)
            self.assertEqual(self.client.post('/auth/admin/reset-password', json={**payload, 'owner_password': 'wrong'}).status_code, 401)
            self.assertEqual(self.client.post('/auth/admin/reset-password', json={**payload, 'ownership_verified': False}).status_code, 422)
            self.assertEqual(self.client.post('/auth/admin/reset-password', json={**payload, 'account_id': owner_id}).status_code, 400)
        with patch.dict('os.environ', {'OWNER_ACCOUNT_ID': target_id}):
            self.rpc.reset_mock()
            self.assertEqual(self.client.post('/auth/admin/reset-password', json=payload).status_code, 403)
            self.assertEqual(self.rpc.call_count, 1)
        self.client.cookies.clear()
        self.assertEqual(self.client.post('/auth/admin/reset-password', json=payload).status_code, 401)

    def test_dashboard_denies_guest(self):
        self.assertEqual(self.client.get('/auth/admin/dashboard').status_code, 401)
        self.rpc.assert_not_called()

    def test_dashboard_denies_other_accounts(self):
        self.client.cookies.set(auth.SESSION_COOKIE, 'A' * 43)
        self.rpc.return_value = {'id': '00000000-0000-0000-0000-000000000002'}
        with patch.dict('os.environ', {'OWNER_ACCOUNT_ID': '00000000-0000-0000-0000-000000000001'}):
            response = self.client.get('/auth/admin/dashboard')
        self.assertEqual(response.status_code, 403)
        self.assertEqual(self.rpc.call_count, 1)
        self.assertEqual(response.headers['cache-control'], 'no-store')

    def test_dashboard_owner_and_pagination(self):
        owner = '00000000-0000-0000-0000-000000000001'
        self.client.cookies.set(auth.SESSION_COOKIE, 'A' * 43)
        self.rpc.side_effect = lambda action, data: {'id': owner} if action == 'session' else {'accounts': []}
        with patch.dict('os.environ', {'OWNER_ACCOUNT_ID': owner}):
            self.assertEqual(self.client.get('/auth/admin/dashboard?page=2').status_code, 200)
            self.rpc.assert_called_with('dashboard', {'offset': 50, 'search': ''})
            self.assertEqual(self.client.get('/auth/admin/dashboard?page=0').status_code, 400)
            self.rpc.side_effect = lambda action, data: {'id': owner} if action == 'session' else {'accounts': [], 'matching_accounts': 0}
            self.assertEqual(self.client.get('/auth/admin/dashboard', params={'page': 2, 'search': '+91 98476-04587'}).status_code, 200)
            self.rpc.assert_called_with('dashboard', {'offset': 50, 'search': '919847604587'})
            self.assertEqual(self.client.get('/auth/admin/dashboard', params={'search': '%'}).status_code, 400)

    def test_owner_config_fails_closed(self):
        with patch.dict('os.environ', {'OWNER_ACCOUNT_ID': ''}):
            self.assertFalse(auth.is_owner({'id': '00000000-0000-0000-0000-000000000001'}))

    def test_feature_labels_are_allowlisted_and_endpoint_scoped(self):
        for label in ('transactions', 'commission', 'monthComparison', 'untrusted'):
            request = Request({'type': 'http', 'headers': [(b'x-app-feature', label.encode())]})
            expected = label if label != 'untrusted' else '/transactions'
            self.assertEqual(auth.activity_feature('/transactions', request), expected)
            self.assertEqual(auth.activity_feature('/count', request), '/count')

    def test_activity_records_only_successful_feature_requests(self):
        for status in (200, 422, 500):
            self.rpc.reset_mock()
            self.rpc.side_effect = lambda action, data: {'id': 'test'} if action == 'session' else {'ok': True}
            request = Request({'type': 'http', 'method': 'POST', 'path': '/count',
                'headers': [(b'origin', auth.ALLOWED_ORIGINS[0].encode()),
                            (b'cookie', f'{auth.SESSION_COOKIE}={"A" * 43}'.encode())],
                'query_string': b''})
            async def next_handler(request):
                return Response(status_code=status)
            response = asyncio.run(auth.account_gate(request, next_handler))
            self.assertEqual(response.status_code, status)
            recorded = [call for call in self.rpc.call_args_list if call.args[0] == 'record_activity']
            self.assertEqual(len(recorded), 1 if status == 200 else 0)
            if recorded:
                self.assertEqual(recorded[0].args[1], {'account_id': 'test', 'feature': '/count'})

    def test_activity_outage_preserves_feature_result(self):
        def reply(action, data):
            if action == 'session':
                return {'id': 'test'}
            raise HTTPException(503, 'Unavailable')
        self.rpc.side_effect = reply
        request = Request({'type': 'http', 'method': 'POST', 'path': '/count',
            'headers': [(b'origin', auth.ALLOWED_ORIGINS[0].encode()),
                        (b'cookie', f'{auth.SESSION_COOKIE}={"A" * 43}'.encode())], 'query_string': b''})
        async def next_handler(request):
            return Response('feature result', status_code=200)
        response = asyncio.run(auth.account_gate(request, next_handler))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.body, b'feature result')

    def test_login_device_challenges_do_not_issue_cookies(self):
        password_hash = auth.hasher.hash('long test password')
        for challenge in ('device_limit', 'replacement_cooldown'):
            def reply(action, data):
                if action == 'limit':
                    return {'allowed': True}
                if action == 'find':
                    return {'id': 'test', 'password_hash': password_hash, 'disabled': False}
                return {'error': challenge, 'devices': []}
            self.rpc.side_effect = reply
            response = self.client.post('/auth/login', json={'mobile': '9447645196', 'password': 'long test password'})
            self.assertEqual(response.status_code, 409)
            self.assertNotIn('set-cookie', response.headers)

    def test_disabled_account_cannot_login(self):
        password_hash = auth.hasher.hash('long test password')
        self.rpc.side_effect = lambda action, data: {'allowed': True} if action == 'limit' else {'id': 'test', 'password_hash': password_hash, 'disabled': True}
        response = self.client.post('/auth/login', json={'mobile': '9447645196', 'password': 'long test password'})
        self.assertEqual(response.status_code, 401)
        self.assertNotIn('set-cookie', response.headers)


if __name__ == '__main__':
    unittest.main()
