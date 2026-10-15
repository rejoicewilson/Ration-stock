import unittest
import asyncio
from unittest.mock import patch

from fastapi.testclient import TestClient
from fastapi import HTTPException
from starlette.requests import Request
from starlette.responses import Response

import account_auth as auth
from main import app


class SubscriptionFoundationTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        self.client.headers['origin'] = auth.ALLOWED_ORIGINS[0]
        self.mock = patch('account_auth.rpc')
        self.rpc = self.mock.start()
        self.addCleanup(self.mock.stop)

    def test_status_requires_a_session(self):
        response = self.client.get('/auth/subscription/status')
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.headers['cache-control'], 'no-store')
        self.rpc.assert_not_called()

    def test_status_uses_signed_in_account_and_separates_modes(self):
        self.client.cookies.set(auth.SESSION_COOKIE, 'A' * 43)

        def response(action, data):
            if action == 'session':
                return {'id': '11111111-1111-4111-8111-111111111111'}
            if action == 'subscription_status':
                return {'active': data['mode'] == 'test',
                        'paid_until': '2026-11-30T00:00:00+00:00' if data['mode'] == 'test' else None}
            raise AssertionError(action)

        self.rpc.side_effect = response
        for mode, expected_active in [('test', True), ('live', False)]:
            with self.subTest(mode=mode), patch.dict('os.environ', {'BILLING_MODE': mode}):
                result = self.client.get('/auth/subscription/status')
                self.assertEqual(result.status_code, 200)
                self.assertEqual(result.headers['cache-control'], 'no-store')
                self.assertEqual(result.json()['active'], expected_active)
                self.assertEqual(result.json()['required'], False)
                self.assertEqual(result.json()['price_paise'], 9900)
                self.assertEqual(result.json()['duration_days'], 30)
                self.assertNotIn('account_id', result.json())
                self.rpc.assert_any_call('subscription_status', {
                    'account_id': '11111111-1111-4111-8111-111111111111', 'mode': mode})

    def test_invalid_mode_fails_without_querying_subscription(self):
        self.client.cookies.set(auth.SESSION_COOKIE, 'A' * 43)
        self.rpc.return_value = {'id': '11111111-1111-4111-8111-111111111111'}
        with patch.dict('os.environ', {'BILLING_MODE': 'invalid'}):
            response = self.client.get('/auth/subscription/status')
        self.assertEqual(response.status_code, 503)
        self.assertEqual(self.rpc.call_count, 1)

    def test_access_switch_defaults_off_and_cannot_enable_in_production(self):
        with patch.dict('os.environ', {'SUBSCRIPTION_ACCESS_REQUIRED': 'false', 'BILLING_MODE': 'test',
                                       'VERCEL_ENV': 'preview'}):
            self.assertFalse(auth.subscription_gate_enabled())
        with patch.dict('os.environ', {'SUBSCRIPTION_ACCESS_REQUIRED': 'true', 'BILLING_MODE': 'test',
                                       'VERCEL_ENV': 'production'}):
            self.assertFalse(auth.subscription_gate_enabled())
        with patch.dict('os.environ', {'SUBSCRIPTION_ACCESS_REQUIRED': 'true', 'BILLING_MODE': 'live',
                                       'VERCEL_ENV': 'preview'}):
            self.assertFalse(auth.subscription_gate_enabled())

    def test_preview_switch_blocks_unpaid_features_without_signing_out(self):
        self.client.cookies.set(auth.SESSION_COOKIE, 'A' * 43)
        self.rpc.side_effect = lambda action, data: (
            {'id': 'member', 'must_change_password': False} if action == 'session' else
            {'active': False, 'paid_until': None} if action == 'subscription_status' else
            {'ok': True})
        with patch.dict('os.environ', {'SUBSCRIPTION_ACCESS_REQUIRED': 'true', 'BILLING_MODE': 'test',
                                       'VERCEL_ENV': 'preview', 'OWNER_ACCOUNT_ID': ''}):
            me = self.client.get('/auth/me')
            status = self.client.get('/auth/subscription/status')
            feature = self.client.post('/count', json={})
        self.assertEqual(me.status_code, 200)
        self.assertTrue(me.json()['account']['subscription_required'])
        self.assertEqual(status.status_code, 200)
        self.assertTrue(status.json()['required'])
        self.assertEqual(feature.status_code, 402)
        self.assertEqual(feature.headers['cache-control'], 'no-store')
        self.rpc.assert_any_call('subscription_status', {'account_id': 'member', 'mode': 'test'})

    def test_preview_switch_allows_active_plan_and_fails_closed_on_status_outage(self):
        request = Request({'type': 'http', 'method': 'POST', 'path': '/count',
            'headers': [(b'origin', auth.ALLOWED_ORIGINS[0].encode()),
                        (b'cookie', f'{auth.SESSION_COOKIE}={"A" * 43}'.encode())],
            'query_string': b''})
        async def next_handler(_request):
            return Response('feature result', status_code=200)
        def reply(action, data):
            if action == 'session':
                return {'id': 'member', 'must_change_password': False}
            if action == 'subscription_status':
                return {'active': True}
            return {'ok': True}
        self.rpc.side_effect = reply
        with patch.dict('os.environ', {'SUBSCRIPTION_ACCESS_REQUIRED': 'true', 'BILLING_MODE': 'test',
                                       'VERCEL_ENV': 'preview', 'OWNER_ACCOUNT_ID': ''}):
            allowed = asyncio.run(auth.account_gate(request, next_handler))
            self.assertEqual(allowed.status_code, 200)
            self.assertEqual(allowed.body, b'feature result')
            self.rpc.side_effect = lambda action, data: (
                {'id': 'member'} if action == 'session' else
                (_ for _ in ()).throw(HTTPException(503, 'Unavailable')))
            unavailable = asyncio.run(auth.account_gate(request, next_handler))
        self.assertEqual(unavailable.status_code, 503)

    def test_preview_owner_can_use_features_without_test_plan(self):
        owner_id = '00000000-0000-0000-0000-000000000001'
        self.rpc.side_effect = lambda action, data: (
            {'id': owner_id, 'must_change_password': False} if action == 'session' else {'ok': True})
        self.client.cookies.set(auth.SESSION_COOKIE, 'A' * 43)
        with patch.dict('os.environ', {'SUBSCRIPTION_ACCESS_REQUIRED': 'true', 'BILLING_MODE': 'test',
                                       'VERCEL_ENV': 'preview', 'OWNER_ACCOUNT_ID': owner_id}):
            me = self.client.get('/auth/me')
            status = self.client.get('/auth/subscription/status')
            self.rpc.reset_mock()
            request = Request({'type': 'http', 'method': 'POST', 'path': '/count',
                'headers': [(b'origin', auth.ALLOWED_ORIGINS[0].encode()),
                            (b'cookie', f'{auth.SESSION_COOKIE}={"A" * 43}'.encode())],
                'query_string': b''})
            async def next_handler(_request):
                return Response(status_code=200)
            feature = asyncio.run(auth.account_gate(request, next_handler))
        self.assertFalse(me.json()['account']['subscription_required'])
        self.assertFalse(status.json()['required'])
        self.assertEqual(feature.status_code, 200)
        self.assertNotIn('subscription_status', [call.args[0] for call in self.rpc.call_args_list])


class SubscriptionRpcRoutingTests(unittest.TestCase):
    def test_status_uses_private_subscription_rpc(self):
        with patch.dict('os.environ', {
            'SUPABASE_URL': 'https://example.supabase.co',
            'SUPABASE_SECRET_KEY': 'sb_secret_test',
        }), patch('account_auth.requests.post') as post:
            post.return_value.json.return_value = {'active': False, 'paid_until': None}
            result = auth.rpc('subscription_status', {'account_id': 'test-account', 'mode': 'test'})

        self.assertEqual(result['active'], False)
        args, kwargs = post.call_args
        self.assertEqual(args[0], 'https://example.supabase.co/rest/v1/rpc/ration_subscription')
        self.assertEqual(kwargs['json']['p_action'], 'subscription_status')
        self.assertEqual(kwargs['json']['p_data']['mode'], 'test')

    def test_billing_actions_use_subscription_rpc(self):
        with patch.dict('os.environ', {
            'SUPABASE_URL': 'https://example.supabase.co',
            'SUPABASE_SECRET_KEY': 'sb_secret_test',
        }), patch('account_auth.requests.post') as post:
            post.return_value.json.return_value = {'ok': True}
            for action in ('billing_intent', 'billing_attach', 'billing_order',
                           'billing_pending', 'billing_activate'):
                auth.rpc(action, {'mode': 'test'})
                self.assertEqual(post.call_args.args[0],
                                 'https://example.supabase.co/rest/v1/rpc/ration_subscription')


if __name__ == '__main__':
    unittest.main()
