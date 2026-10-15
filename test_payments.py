import hashlib
import hmac
import json
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient
from fastapi import HTTPException

import account_auth as auth
import payments
from main import app


ACCOUNT = '11111111-1111-4111-8111-111111111111'
ORDER = {'order_id': 'order_ABC123', 'account_id': ACCOUNT, 'amount_paise': 9900}
PAYMENT = {'id': 'pay_ABC123', 'order_id': ORDER['order_id'], 'amount': 9900,
           'currency': 'INR', 'status': 'captured', 'captured': True, 'amount_refunded': 0}
ENV = {'PAYMENTS_ENABLED': 'true', 'BILLING_MODE': 'test',
       'RAZORPAY_KEY_ID': 'rzp_test_example', 'RAZORPAY_KEY_SECRET': 'test-secret',
       'RAZORPAY_WEBHOOK_SECRET': 'hook-secret'}
LIVE_ENV = {'PAYMENTS_ENABLED': 'true', 'BILLING_MODE': 'live', 'VERCEL_ENV': 'preview',
            'VERCEL_GIT_COMMIT_REF': 'feature/99-subscription',
            'LIVE_PILOT_ENABLED': 'true', 'LIVE_PILOT_FPS_ID': '1234567',
            'LIVE_PILOT_MOBILE': '919999999999', 'RAZORPAY_KEY_ID': 'rzp_live_example',
            'RAZORPAY_KEY_SECRET': 'live-secret', 'RAZORPAY_WEBHOOK_SECRET': 'live-hook-secret'}


class PaymentTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        self.client.headers['origin'] = auth.ALLOWED_ORIGINS[0]
        self.client.cookies.set(auth.SESSION_COOKIE, 'A' * 43)
        self.env = patch.dict('os.environ', ENV)
        self.env.start()
        self.addCleanup(self.env.stop)
        self.rpc_patch = patch('payments.rpc', side_effect=self.rpc_reply)
        self.rpc = self.rpc_patch.start()
        self.addCleanup(self.rpc_patch.stop)
        self.session_patch = patch('payments.session_user', return_value={
            'id': ACCOUNT, 'mobile': '919999999999'})
        self.session = self.session_patch.start()
        self.addCleanup(self.session_patch.stop)
        self.razor_patch = patch('payments.razor', return_value=PAYMENT.copy())
        self.razor = self.razor_patch.start()
        self.addCleanup(self.razor_patch.stop)

    def rpc_reply(self, action, data):
        if action == 'limit':
            return {'allowed': True}
        if action == 'billing_order':
            return ORDER.copy()
        if action == 'billing_activate':
            return {'ok': True, 'duplicate': False, 'paid_until': '2026-11-12T00:00:00Z'}
        if action == 'billing_pending':
            return [ORDER.copy()]
        if action == 'subscription_status':
            return {'active': True, 'paid_until': '2026-11-12T00:00:00Z'}
        return {'ok': True}

    def signed_body(self):
        body = {'razorpay_order_id': ORDER['order_id'], 'razorpay_payment_id': PAYMENT['id']}
        body['razorpay_signature'] = hmac.new(b'test-secret',
            f"{ORDER['order_id']}|{PAYMENT['id']}".encode(), hashlib.sha256).hexdigest()
        return body

    def test_order_requires_session_and_enabled_test_config(self):
        self.session.side_effect = HTTPException(401, 'Please sign in.')
        self.assertEqual(self.client.post('/auth/subscription/order').status_code, 401)
        self.session.side_effect = None
        with patch.dict('os.environ', {'PAYMENTS_ENABLED': 'false'}):
            self.assertEqual(self.client.post('/auth/subscription/order').status_code, 503)
        with patch.dict('os.environ', {'BILLING_MODE': 'live'}):
            self.assertEqual(self.client.post('/auth/subscription/order').status_code, 503)
        self.razor.assert_not_called()

    def test_order_created_for_signed_in_account(self):
        def create(method, path, payload):
            self.assertEqual((method, path), ('POST', 'orders'))
            self.assertEqual(payload['amount'], 9900)
            return {'id': ORDER['order_id'], 'amount': 9900, 'currency': 'INR',
                    'receipt': payload['receipt']}
        self.razor.side_effect = create
        result = self.client.post('/auth/subscription/order')
        self.assertEqual(result.status_code, 200)
        self.assertEqual(result.json()['mode'], 'test')
        self.assertEqual(result.json()['amount'], 9900)
        intent = next(data for action, data in (c.args for c in self.rpc.call_args_list)
                      if action == 'billing_intent')
        self.assertEqual(intent['account_id'], ACCOUNT)
        self.assertEqual(intent['mode'], 'test')

    def test_verify_requires_signature_and_captured_payment(self):
        body = self.signed_body()
        self.assertEqual(self.client.post('/auth/subscription/verify',
            json={**body, 'razorpay_signature': '0' * 64}).status_code, 400)
        self.assertFalse(any(c.args[0] == 'billing_activate' for c in self.rpc.call_args_list))
        self.razor.return_value = {**PAYMENT, 'status': 'authorized', 'captured': False}
        pending = self.client.post('/auth/subscription/verify', json=body)
        self.assertEqual(pending.status_code, 200)
        self.assertTrue(pending.json()['pending'])
        self.assertFalse(any(c.args[0] == 'billing_activate' for c in self.rpc.call_args_list))
        self.razor.return_value = PAYMENT.copy()
        success = self.client.post('/auth/subscription/verify', json=body)
        self.assertEqual(success.status_code, 200)
        self.assertTrue(success.json()['ok'])
        self.rpc.assert_any_call('billing_activate', {
            'order_id': ORDER['order_id'], 'payment_id': PAYMENT['id'], 'mode': 'test'})

    def test_verify_rejects_other_account_amount_and_refund(self):
        body = self.signed_body()
        with patch('payments.stored_order', side_effect=payments.HTTPException(404)):
            self.assertEqual(self.client.post('/auth/subscription/verify', json=body).status_code, 404)
        for changed in ({'amount': 1}, {'order_id': 'order_OTHER'}, {'amount_refunded': 9900}):
            self.razor.return_value = {**PAYMENT, **changed}
            self.assertIn(self.client.post('/auth/subscription/verify', json=body).status_code, (400, 409))
        self.assertFalse(any(c.args[0] == 'billing_activate' for c in self.rpc.call_args_list))

    def test_reconcile_captured_order(self):
        self.razor.return_value = {'items': [PAYMENT.copy()]}
        result = self.client.post('/auth/subscription/reconcile')
        self.assertEqual(result.status_code, 200)
        self.assertTrue(result.json()['active'])
        self.assertTrue(any(c.args[0] == 'billing_activate' for c in self.rpc.call_args_list))

    def test_webhook_signature_and_unknown_order(self):
        event = {'event': 'payment.captured', 'payload': {'payment': {'entity': PAYMENT}}}
        raw = json.dumps(event).encode()
        self.assertEqual(self.client.post('/auth/subscription/webhook', content=raw,
            headers={'x-razorpay-signature': '0' * 64, 'origin': ''}).status_code, 400)
        signature = hmac.new(b'hook-secret', raw, hashlib.sha256).hexdigest()
        with patch.dict('os.environ', {'PAYMENTS_ENABLED': 'false'}):
            response = self.client.post('/auth/subscription/webhook', content=raw,
                headers={'x-razorpay-signature': signature, 'origin': ''})
            self.assertEqual(response.status_code, 200)
        self.assertTrue(any(c.args[0] == 'billing_activate' for c in self.rpc.call_args_list))
        self.rpc.side_effect = lambda action, data: None if action == 'billing_order' else self.rpc_reply(action, data)
        self.razor.reset_mock()
        response = self.client.post('/auth/subscription/webhook', content=raw,
            headers={'x-razorpay-signature': signature, 'origin': ''})
        self.assertEqual(response.status_code, 200)
        self.razor.assert_not_called()

    def test_live_pilot_order_only_for_exact_account_in_preview(self):
        with patch.dict('os.environ', LIVE_ENV):
            self.session.return_value = {'id': ACCOUNT, 'fps_id': '1234567', 'mobile': '919999999999'}
            self.razor.return_value = {'id': ORDER['order_id'], 'amount': 9900,
                                       'currency': 'INR'}
            def create(method, path, payload):
                return {**self.razor.return_value, 'receipt': payload['receipt']}
            self.razor.side_effect = create
            result = self.client.post('/auth/subscription/order')
            self.assertEqual(result.status_code, 200)
            self.assertEqual(result.json()['mode'], 'live')
            self.assertTrue(result.json()['key'].startswith('rzp_live_'))
            intent = next(data for action, data in (c.args for c in self.rpc.call_args_list)
                          if action == 'billing_intent')
            self.assertEqual(intent['account_id'], ACCOUNT)
            self.assertEqual(intent['mode'], 'live')
            self.rpc.reset_mock()
            for account in ({'id': ACCOUNT, 'fps_id': '1234567', 'mobile': '919888888888'},
                            {'id': ACCOUNT, 'fps_id': '7654321', 'mobile': '919999999999'}):
                self.session.return_value = account
                self.assertEqual(self.client.post('/auth/subscription/order').status_code, 403)
            self.assertFalse(any(c.args[0] == 'billing_intent' for c in self.rpc.call_args_list))
            self.session.return_value = {'id': ACCOUNT, 'fps_id': '1234567', 'mobile': '919999999999'}
            with patch.dict('os.environ', {'VERCEL_ENV': 'production'}):
                self.assertEqual(self.client.post('/auth/subscription/order').status_code, 503)

    def test_live_pilot_verify_and_webhook_use_live_ledger(self):
        live_order = {**ORDER, 'mode': 'live'}
        with patch.dict('os.environ', LIVE_ENV):
            self.session.return_value = {'id': ACCOUNT, 'fps_id': '1234567', 'mobile': '919999999999'}
            self.rpc.side_effect = lambda action, data: (
                live_order.copy() if action == 'billing_order' else self.rpc_reply(action, data))
            body = {'razorpay_order_id': ORDER['order_id'], 'razorpay_payment_id': PAYMENT['id']}
            body['razorpay_signature'] = hmac.new(b'live-secret',
                f"{ORDER['order_id']}|{PAYMENT['id']}".encode(), hashlib.sha256).hexdigest()
            self.assertEqual(self.client.post('/auth/subscription/verify', json=body).status_code, 200)
            self.rpc.assert_any_call('billing_activate', {
                'order_id': ORDER['order_id'], 'payment_id': PAYMENT['id'], 'mode': 'live'})
            self.rpc.reset_mock()
            event = {'event': 'payment.captured', 'payload': {'payment': {'entity': PAYMENT}}}
            raw = json.dumps(event).encode()
            signature = hmac.new(b'live-hook-secret', raw, hashlib.sha256).hexdigest()
            test_signature = hmac.new(b'hook-secret', raw, hashlib.sha256).hexdigest()
            self.assertEqual(self.client.post('/auth/subscription/webhook', content=raw,
                headers={'x-razorpay-signature': test_signature, 'origin': ''}).status_code, 400)
            with patch.dict('os.environ', {'PAYMENTS_ENABLED': 'false', 'LIVE_PILOT_ENABLED': 'false'}):
                response = self.client.post('/auth/subscription/webhook', content=raw,
                    headers={'x-razorpay-signature': signature, 'origin': ''})
            self.assertEqual(response.status_code, 200)
            self.rpc.assert_any_call('billing_activate', {
                'order_id': ORDER['order_id'], 'payment_id': PAYMENT['id'], 'mode': 'live'})


if __name__ == '__main__':
    unittest.main()
