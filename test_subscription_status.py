import asyncio
import unittest
from datetime import datetime, timedelta
from unittest.mock import Mock, patch

from fastapi import HTTPException
from fastapi.testclient import TestClient
from starlette.requests import Request
from starlette.responses import Response

import account_auth as auth
from main import app
from subscription_plans import DEFAULT_FREE_UNTIL, parse_instant, plan_status


class PlanStatusTests(unittest.TestCase):
    def test_launch_boundary_is_midnight_ist(self):
        cutoff = parse_instant(DEFAULT_FREE_UNTIL)
        self.assertEqual(cutoff.isoformat(), '2026-10-31T18:30:00+00:00')
        before = plan_status(None, DEFAULT_FREE_UNTIL, now=cutoff - timedelta(microseconds=1))
        self.assertEqual(before['plan'], 'free')
        self.assertTrue(before['free_access_active'])
        for now in (cutoff, cutoff + timedelta(seconds=1)):
            with self.subTest(now=now):
                status = plan_status(None, DEFAULT_FREE_UNTIL, now=now)
                self.assertEqual(status['plan'], 'inactive')
                self.assertFalse(status['free_access_active'])
                self.assertTrue(status['enforcement_enabled'])
                self.assertFalse(status['access_allowed'])

    def test_paid_plan_takes_priority_and_expires_at_exact_instant(self):
        expiry = '2026-11-20T10:00:00+05:30'
        for now in ('2026-10-20T00:00:00Z', '2026-11-10T00:00:00Z'):
            with self.subTest(now=now):
                status = plan_status(expiry, DEFAULT_FREE_UNTIL, now=parse_instant(now))
                self.assertEqual(status['plan'], 'paid')
                self.assertTrue(status['paid_active'])
                self.assertEqual(status['paid_until'], '2026-11-20T04:30:00+00:00')
        status = plan_status(expiry, DEFAULT_FREE_UNTIL, now=parse_instant(expiry))
        self.assertEqual(status['plan'], 'expired')
        self.assertFalse(status['paid_active'])

    def test_past_paid_plan_still_gets_remaining_free_period(self):
        status = plan_status('2026-10-01T00:00:00Z', DEFAULT_FREE_UNTIL,
                             now=parse_instant('2026-10-20T00:00:00Z'))
        self.assertEqual(status['plan'], 'free')
        self.assertFalse(status['paid_active'])

    def test_timestamps_require_timezone(self):
        for value in ('', 'bad', '2026-11-01T00:00:00', '2026-11-01'):
            with self.subTest(value=value):
                with self.assertRaises(ValueError):
                    parse_instant(value)


class PlanEndpointTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        self.client.cookies.set(auth.SESSION_COOKIE, 'A' * 43)
        self.account_id = '00000000-0000-0000-0000-000000000001'
        self.rpc_patch = patch('account_auth.rpc')
        self.rpc = self.rpc_patch.start()
        self.addCleanup(self.rpc_patch.stop)
        self.rpc.side_effect = lambda action, data: (
            {'id': self.account_id} if action == 'session' else {'paid_until': None, 'free_until': None})
        self.config_patch = patch.dict('os.environ', {'SUBSCRIPTION_FREE_UNTIL': DEFAULT_FREE_UNTIL, 'BILLING_MODE': 'live'})
        self.config_patch.start()
        self.addCleanup(self.config_patch.stop)

    def test_signed_out_and_expired_session_cannot_read_plans(self):
        self.client.cookies.clear()
        self.assertEqual(self.client.get('/auth/subscription/status').status_code, 401)
        self.rpc.assert_not_called()
        self.client.cookies.set(auth.SESSION_COOKIE, 'A' * 43)
        self.rpc.return_value = None
        self.rpc.side_effect = None
        self.assertEqual(self.client.get('/auth/subscription/status').status_code, 401)
        self.assertEqual(self.rpc.call_count, 1)

    def test_own_live_plan_only_and_no_cache(self):
        response = self.client.get('/auth/subscription/status?account_id=another-account&mode=test')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers['cache-control'], 'no-store')
        self.rpc.assert_called_with('subscription_status', {'account_id': self.account_id, 'mode': 'live'})
        body = response.json()
        self.assertEqual(body['mode'], 'live')
        self.assertIsNone(body['paid_until'])
        self.assertFalse(body['paid_active'])
        self.assertTrue(body['enforcement_enabled'])
        self.assertEqual(body['price_paise'], 9900)
        self.assertEqual(body['duration_days'], 30)

    def test_database_outage_reports_unavailable(self):
        def reply(action, data):
            if action == 'session':
                return {'id': self.account_id}
            raise HTTPException(503, 'Temporarily unavailable')
        self.rpc.side_effect = reply
        response = self.client.get('/auth/subscription/status')
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.headers['cache-control'], 'no-store')

    def test_server_configuration_selects_test_mode_not_browser_input(self):
        with patch.dict('os.environ', {'BILLING_MODE': 'test'}):
            response = self.client.get('/auth/subscription/status?mode=live')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['mode'], 'test')
        self.rpc.assert_called_with('subscription_status', {'account_id': self.account_id, 'mode': 'test'})

    def test_invalid_database_response_does_not_claim_a_plan(self):
        for result in (None, [], {}, {'paid_until': None},
                       {'paid_until': 'bad', 'free_until': None},
                       {'paid_until': '2026-12-01', 'free_until': None},
                       {'paid_until': 123, 'free_until': None},
                       {'paid_until': None, 'free_until': ''}):
            with self.subTest(result=result):
                self.rpc.side_effect = lambda action, data: {'id': self.account_id} if action == 'session' else result
                self.assertEqual(self.client.get('/auth/subscription/status').status_code, 503)

    def test_invalid_free_cutoff_reports_unavailable(self):
        with patch.dict('os.environ', {'SUBSCRIPTION_FREE_UNTIL': '2026-11-01'}):
            self.assertEqual(self.client.get('/auth/subscription/status').status_code, 503)

    def test_only_account_with_database_override_expires_early(self):
        other_id = '00000000-0000-0000-0000-000000000002'
        for account_id, expected in ((self.account_id, 'inactive'), (other_id, 'free')):
            with self.subTest(account_id=account_id):
                def reply(action, data):
                    if action == 'session':
                        return {'id': account_id}
                    return {'paid_until': None, 'free_until':
                            '2026-10-16T00:00:00+05:30' if data['account_id'] == self.account_id else None}
                self.rpc.side_effect = reply
                with patch('subscription_plans.datetime') as clock:
                    clock.fromisoformat.side_effect = datetime.fromisoformat
                    clock.now.return_value = datetime.fromisoformat('2026-10-16T00:00:00+05:30')
                    response = self.client.get('/auth/subscription/status')
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.json()['plan'], expected)
                self.assertTrue(response.json()['enforcement_enabled'])
                self.assertEqual(response.json()['access_allowed'], expected == 'free')

    def test_active_paid_plan_survives_free_override(self):
        self.rpc.side_effect = lambda action, data: {'id': self.account_id} if action == 'session' else {
            'paid_until': '2026-12-01T00:00:00Z', 'free_until': '2026-10-16T00:00:00+05:30'}
        with patch('subscription_plans.datetime') as clock:
            clock.fromisoformat.side_effect = datetime.fromisoformat
            clock.now.return_value = datetime.fromisoformat('2026-10-16T00:00:00+05:30')
            response = self.client.get('/auth/subscription/status')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['plan'], 'paid')

    def test_plan_outage_preserves_account_details_but_blocks_features(self):
        def reply(action, data):
            if action == 'session':
                return {'id': self.account_id}
            if action == 'record_activity':
                return {'ok': True}
            raise HTTPException(503, 'Plan service unavailable')
        self.rpc.side_effect = reply
        self.assertEqual(self.client.get('/auth/me').status_code, 200)
        request = Request({'type': 'http', 'method': 'POST', 'path': '/count',
            'headers': [(b'origin', auth.ALLOWED_ORIGINS[0].encode()),
                        (b'cookie', f'{auth.SESSION_COOKIE}={"A" * 43}'.encode())], 'query_string': b''})
        async def next_handler(request):
            return Response('feature result', status_code=200)
        response = asyncio.run(auth.account_gate(request, next_handler))
        self.assertEqual(response.status_code, 503)
        self.assertIn('subscription_status', [call.args[0] for call in self.rpc.call_args_list])
        self.assertNotIn('record_activity', [call.args[0] for call in self.rpc.call_args_list])


class SubscriptionEnforcementTests(unittest.TestCase):
    def setUp(self):
        self.account_id = '00000000-0000-0000-0000-000000000001'
        self.client = TestClient(app)
        self.client.cookies.set(auth.SESSION_COOKIE, 'A' * 43)
        self.client.headers['origin'] = auth.ALLOWED_ORIGINS[0]
        self.data = {'paid_until': None, 'free_until': '2026-10-16T00:00:00+05:30'}
        self.rpc_patch = patch('account_auth.rpc', side_effect=self.reply)
        self.rpc = self.rpc_patch.start()
        self.addCleanup(self.rpc_patch.stop)
        clock = patch('subscription_plans.datetime')
        mocked_clock = clock.start()
        self.addCleanup(clock.stop)
        mocked_clock.fromisoformat.side_effect = datetime.fromisoformat
        mocked_clock.now.return_value = datetime.fromisoformat('2026-10-16T00:00:00+05:30')
        config = patch.dict('os.environ', {'SUBSCRIPTION_FREE_UNTIL': DEFAULT_FREE_UNTIL, 'BILLING_MODE': 'live'})
        config.start()
        self.addCleanup(config.stop)

    def reply(self, action, data):
        if action == 'session':
            return {'id': self.account_id}
        if action == 'subscription_status':
            self.assertEqual(data, {'account_id': self.account_id, 'mode': 'live'})
            return self.data
        if action == 'record_activity':
            return {'ok': True}
        raise AssertionError(f'Unexpected operation: {action}')

    def test_expired_account_cannot_call_any_feature_directly(self):
        for path in auth.PROTECTED_PATHS:
            for suffix in ('', '/'):
                for method in ('GET', 'POST'):
                    with self.subTest(path=path, suffix=suffix, method=method):
                        response = self.client.request(method, path + suffix,
                            headers={'x-app-feature': 'untrusted', 'x-subscription-active': 'true'},
                            params={'account_id': 'other-account', 'mode': 'test'})
                        self.assertEqual(response.status_code, 402)
                        self.assertEqual(response.json()['detail']['code'], 'subscription_required')
                        self.assertFalse(response.json()['detail']['subscription']['access_allowed'])
                        self.assertEqual(response.headers['cache-control'], 'no-store')
                        self.assertNotIn('set-cookie', response.headers)
        self.assertNotIn('record_activity', [call.args[0] for call in self.rpc.call_args_list])

    def test_expired_account_keeps_session_and_account_routes(self):
        self.assertEqual(self.client.post('/transactions', json={}).status_code, 402)
        self.assertEqual(self.client.get('/auth/me').status_code, 200)
        status = self.client.get('/auth/subscription/status')
        self.assertEqual(status.status_code, 200)
        self.assertFalse(status.json()['access_allowed'])

    def test_free_or_live_paid_account_reaches_feature_handler(self):
        for data in (
            {'paid_until': None, 'free_until': None},
            {'paid_until': '2026-11-01T00:00:00Z', 'free_until': '2026-10-16T00:00:00+05:30'},
        ):
            with self.subTest(data=data):
                self.data = data
                self.rpc.reset_mock()
                request = Request({'type': 'http', 'method': 'POST', 'path': '/transactions',
                    'headers': [(b'origin', auth.ALLOWED_ORIGINS[0].encode()),
                                (b'cookie', f'{auth.SESSION_COOKIE}={"A" * 43}'.encode())], 'query_string': b''})
                async def next_handler(request):
                    return Response('feature result', status_code=200)
                response = asyncio.run(auth.account_gate(request, next_handler))
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.body, b'feature result')
                self.assertEqual([call.args[0] for call in self.rpc.call_args_list],
                                 ['session', 'subscription_status', 'record_activity'])

    def test_expired_paid_plan_cannot_unlock_expired_free_period(self):
        self.data['paid_until'] = '2026-10-15T18:30:00Z'
        self.assertEqual(self.client.post('/transactions', json={}).status_code, 402)

    def test_malformed_or_unavailable_status_does_not_unlock_features(self):
        for data in ({}, {'paid_until': None, 'free_until': 'invalid'}):
            with self.subTest(data=data):
                self.data = data
                self.assertEqual(self.client.post('/transactions', json={}).status_code, 503)
        self.rpc.side_effect = lambda action, data: {'id': self.account_id} if action == 'session' else (_ for _ in ()).throw(HTTPException(503, 'Unavailable'))
        self.assertEqual(self.client.post('/transactions', json={}).status_code, 503)


class PlanTransportTests(unittest.TestCase):
    def test_status_calls_read_only_plan_rpc_without_writes(self):
        response = Mock()
        response.json.return_value = {'paid_until': None, 'free_until': None}
        with patch.dict('os.environ', {'SUPABASE_URL': 'https://example.supabase.co',
                                      'SUPABASE_SECRET_KEY': 'sb_secret_test'}):
            with patch('account_auth.requests.post', return_value=response) as post:
                result = auth.rpc('subscription_status', {'account_id': 'own-id', 'mode': 'live'})
        self.assertIsNone(result['paid_until'])
        self.assertEqual(post.call_count, 1)
        self.assertEqual(post.call_args.args[0], 'https://example.supabase.co/rest/v1/rpc/ration_plan_status')
        self.assertEqual(post.call_args.kwargs['json'], {
            'p_action': 'subscription_status', 'p_data': {'account_id': 'own-id', 'mode': 'live'}})


if __name__ == '__main__':
    unittest.main()
