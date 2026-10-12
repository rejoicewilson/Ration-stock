import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

import account_auth as auth
from main import app


class SubscriptionFoundationTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
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
