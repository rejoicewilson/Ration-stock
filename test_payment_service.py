import hashlib
import hmac
import json
import unittest
from copy import deepcopy
from unittest.mock import Mock, patch

import requests
from fastapi import HTTPException
from fastapi.testclient import TestClient

import account_auth as auth
import payment_service as pay
from main import app


ACCOUNT = {'id': '00000000-0000-0000-0000-000000000001', 'mobile': '919999999998'}
OTHER = '00000000-0000-0000-0000-000000000002'
RECEIPT = '00000000-0000-0000-0000-000000000010'
CONFIG = pay.Settings('test', 'rzp_test_fixture', 'test-secret', 'webhook-secret')
ROW = {'receipt': RECEIPT, 'account_id': ACCOUNT['id'], 'mode': 'test', 'gateway_key_id': CONFIG.key_id,
       'amount_paise': 9900, 'order_id': 'order_fixture', 'new_intent': False}
ORDER = {'id': 'order_fixture', 'receipt': RECEIPT, 'amount': 9900, 'currency': 'INR', 'status': 'created'}
PAYMENT = {'id': 'pay_fixture', 'order_id': 'order_fixture', 'amount': 9900, 'currency': 'INR',
           'status': 'captured', 'captured': True, 'amount_refunded': 0, 'refund_status': None}


def signature(message, secret=CONFIG.key_secret):
    return hmac.new(secret.encode(), message, hashlib.sha256).hexdigest()


class PaymentServiceTests(unittest.TestCase):
    def setUp(self):
        self.row = deepcopy(ROW)
        self.order = deepcopy(ORDER)
        self.payment = deepcopy(PAYMENT)
        self.store = Mock(side_effect=self.reply)
        self.checkout = pay.Checkout(self.store, CONFIG)
        self.remote_patch = patch('payment_service.gateway', side_effect=self.remote)
        self.gateway = self.remote_patch.start()
        self.addCleanup(self.remote_patch.stop)

    def reply(self, action, data):
        self.assertEqual(data['mode'], 'test')
        self.assertEqual(data['key_id'], CONFIG.key_id)
        if action in ('checkout_get', 'checkout_prepare'):
            if data.get('account_id') not in (None, ACCOUNT['id']):
                return None
            return deepcopy(self.row)
        if action == 'checkout_attach':
            self.row['order_id'] = data['order_id']
            return deepcopy(self.row)
        if action == 'checkout_activate':
            return {'ok': True, 'paid_until': '2026-11-16T00:00:00Z'}
        if action == 'checkout_pending':
            return [deepcopy(self.row)]
        if action == 'checkout_creation_failed':
            return {'ok': True}
        raise AssertionError(action)

    def remote(self, config, method, path, **kwargs):
        self.assertEqual(config, CONFIG)
        if path == 'orders' and method == 'POST':
            return deepcopy(self.order)
        if path == 'orders':
            return {'items': [deepcopy(self.order)]}
        if path == 'orders/order_fixture':
            return deepcopy(self.order)
        if path == 'payments/pay_fixture':
            return deepcopy(self.payment)
        if path == 'orders/order_fixture/payments':
            return {'items': []}
        raise AssertionError(path)

    def activated_calls(self):
        return [call for call in self.store.call_args_list if call.args[0] == 'checkout_activate']

    def verify(self, account=ACCOUNT, sig=None):
        return self.checkout.verify(account, 'order_fixture', 'pay_fixture',
            sig if sig is not None else signature(b'order_fixture|pay_fixture'))

    def test_capture_signature_and_ownership_required(self):
        result = self.verify()
        self.assertTrue(result['activated'])
        data = self.activated_calls()[0].args[1]
        self.assertEqual(data['account_id'], ACCOUNT['id'])
        self.assertEqual(data['payment_id'], 'pay_fixture')
        self.assertEqual(data['amount_paise'], 9900)
        self.assertEqual(data['currency'], 'INR')

    def test_bad_signature_cannot_activate_or_fetch_payment(self):
        with self.assertRaises(HTTPException) as caught:
            self.verify(sig='0' * 64)
        self.assertEqual(caught.exception.status_code, 400)
        self.gateway.assert_not_called()
        self.assertEqual(self.activated_calls(), [])

    def test_other_account_cannot_claim_payment(self):
        with self.assertRaises(HTTPException) as caught:
            self.verify(account={'id': OTHER})
        self.assertEqual(caught.exception.status_code, 404)
        self.assertEqual(self.activated_calls(), [])

    def test_authorized_failed_and_refunded_payments_cannot_activate(self):
        for status in ('authorized', 'failed', 'created', 'refunded'):
            with self.subTest(status=status):
                self.payment.update(status=status, captured=False)
                self.assertFalse(self.verify()['activated'])
        self.assertEqual(self.activated_calls(), [])

    def test_amount_currency_order_id_and_refunds_are_validated(self):
        for change in ({'amount': 100}, {'currency': 'USD'}, {'order_id': 'order_other'},
                       {'amount_refunded': 1}, {'refund_status': 'partial'}, {'id': 'pay_other'}):
            with self.subTest(change=change):
                self.payment = {**PAYMENT, **change}
                with self.assertRaises(HTTPException):
                    self.verify()
        self.assertEqual(self.activated_calls(), [])

    def test_gateway_order_receipt_and_amount_are_validated(self):
        for change in ({'receipt': 'another-receipt'}, {'amount': 1}, {'currency': 'USD'}, {'id': 'order_other'}):
            with self.subTest(change=change):
                self.order = {**ORDER, **change}
                with self.assertRaises(HTTPException):
                    self.verify()
        self.assertEqual(self.activated_calls(), [])

    def test_new_order_price_is_owned_by_server(self):
        self.row.update(new_intent=True, order_id=None)
        result = self.checkout.start(ACCOUNT)
        self.assertEqual(result['amount'], 9900)
        self.assertEqual(result['mode'], 'test')
        self.assertNotIn('secret', json.dumps(result))
        post = [call for call in self.gateway.call_args_list if call.args[1] == 'POST'][0]
        self.assertEqual(post.kwargs['json']['amount'], 9900)
        self.assertFalse(post.kwargs['json']['partial_payment'])
        self.assertEqual(post.kwargs['json']['receipt'], RECEIPT)
        self.assertEqual(post.kwargs['json']['notes']['account_id'], ACCOUNT['id'])

    def test_repeat_click_reuses_order_without_gateway_create(self):
        self.checkout.start(ACCOUNT)
        self.assertNotIn('POST', [call.args[1] for call in self.gateway.call_args_list])

    def test_inflight_authorization_blocks_second_attempt(self):
        base = self.remote
        self.gateway.side_effect = lambda config, method, path, **kw: (
            {'items': [{'status': 'authorized'}]} if path.endswith('/payments') else base(config, method, path, **kw))
        with self.assertRaises(HTTPException) as caught:
            self.checkout.start(ACCOUNT)
        self.assertEqual(caught.exception.status_code, 409)

    def test_uncertain_create_is_recovered_by_receipt_not_recreated(self):
        self.row.update(order_id=None)
        self.assertEqual(self.checkout.start(ACCOUNT)['order_id'], ORDER['id'])
        self.assertIn('checkout_attach', [call.args[0] for call in self.store.call_args_list])
        self.assertNotIn('POST', [call.args[1] for call in self.gateway.call_args_list])

    def test_create_timeout_remains_pending_for_recovery(self):
        self.row.update(new_intent=True, order_id=None)
        self.gateway.side_effect = pay.GatewayError()
        with self.assertRaises(pay.GatewayError):
            self.checkout.start(ACCOUNT)
        self.assertNotIn('checkout_creation_failed', [call.args[0] for call in self.store.call_args_list])

    def test_definitive_create_rejection_can_be_retried(self):
        self.row.update(new_intent=True, order_id=None)
        self.gateway.side_effect = pay.GatewayError(definitive=True)
        with self.assertRaises(pay.GatewayError):
            self.checkout.start(ACCOUNT)
        self.assertIn('checkout_creation_failed', [call.args[0] for call in self.store.call_args_list])

    def test_reconcile_fetches_captured_payment_and_activates(self):
        base = self.remote
        self.gateway.side_effect = lambda config, method, path, **kw: (
            {'items': [deepcopy(PAYMENT)]} if path.endswith('/payments') else base(config, method, path, **kw))
        self.assertTrue(self.checkout.reconcile(ACCOUNT)['activated'])
        self.assertEqual(len(self.activated_calls()), 1)

    def test_webhook_raw_signature_required_before_any_lookup(self):
        body = json.dumps({'event': 'payment.captured', 'payload': {'payment': {'entity': PAYMENT}}}).encode()
        with self.assertRaises(HTTPException):
            self.checkout.webhook(body, 'bad')
        self.store.assert_not_called()
        self.gateway.assert_not_called()
        self.assertTrue(self.checkout.webhook(body, signature(body, CONFIG.webhook_secret))['ok'])
        self.assertEqual(len(self.activated_calls()), 1)

    def test_order_paid_webhook_and_ignored_event(self):
        base = self.remote
        self.gateway.side_effect = lambda config, method, path, **kw: (
            {'items': [deepcopy(PAYMENT)]} if path.endswith('/payments') else base(config, method, path, **kw))
        body = json.dumps({'event': 'order.paid', 'payload': {'order': {'entity': ORDER}}}).encode()
        self.assertTrue(self.checkout.webhook(body, signature(body, CONFIG.webhook_secret))['ok'])
        self.store.reset_mock()
        ignored = b'{"event":"payment.failed"}'
        self.assertTrue(self.checkout.webhook(ignored, signature(ignored, CONFIG.webhook_secret))['ignored'])
        self.store.assert_not_called()

    def test_duplicate_notifications_use_same_activation_identity(self):
        self.verify()
        self.verify()
        self.assertEqual(self.activated_calls()[0].args, self.activated_calls()[1].args)


class PaymentConfigurationTests(unittest.TestCase):
    def test_disabled_mismatched_and_unconfigured_payments_rejected(self):
        with patch.dict('os.environ', {'PAYMENTS_ENABLED': 'false'}):
            with self.assertRaises(HTTPException):
                pay.settings(enabled=True)
        for mode, key in (('live', 'rzp_test_fixture'), ('test', 'rzp_live_fixture'), ('wrong', 'rzp_test_fixture')):
            with patch.dict('os.environ', {'PAYMENTS_ENABLED': 'true', 'BILLING_MODE': mode,
                                         'RAZORPAY_KEY_ID': key, 'RAZORPAY_KEY_SECRET': 'fixture'}):
                with self.assertRaises(HTTPException):
                    pay.settings(enabled=True)

    def test_live_requires_webhook_and_secrets_never_enter_repr(self):
        with patch.dict('os.environ', {'PAYMENTS_ENABLED': 'true', 'BILLING_MODE': 'live',
                'RAZORPAY_KEY_ID': 'rzp_live_fixture', 'RAZORPAY_KEY_SECRET': 'private-api',
                'RAZORPAY_WEBHOOK_SECRET': ''}):
            with self.assertRaises(HTTPException):
                pay.settings(enabled=True)
        self.assertNotIn(CONFIG.key_secret, repr(CONFIG))
        self.assertNotIn(CONFIG.webhook_secret, repr(CONFIG))

    def test_gateway_errors_do_not_expose_credentials_or_response_bodies(self):
        with patch('payment_service.requests.request', side_effect=requests.Timeout('private-body')):
            with self.assertRaises(pay.GatewayError) as caught:
                pay.gateway(CONFIG, 'POST', 'orders')
        self.assertNotIn('private-body', caught.exception.detail)
        self.assertNotIn(CONFIG.key_secret, caught.exception.detail)


class PaymentEndpointTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        self.client.headers['origin'] = auth.ALLOWED_ORIGINS[0]
        self.auth_patch = patch('account_auth.rpc', side_effect=self.reply)
        self.rpc = self.auth_patch.start()
        self.addCleanup(self.auth_patch.stop)
        self.config_patch = patch('payment_service.settings', return_value=CONFIG)
        self.config_patch.start()
        self.addCleanup(self.config_patch.stop)
        self.remote_patch = patch('payment_service.gateway', side_effect=AssertionError('Unexpected live request'))
        self.remote_patch.start()
        self.addCleanup(self.remote_patch.stop)

    def reply(self, action, data):
        if action == 'session': return ACCOUNT
        if action == 'limit': return {'allowed': True}
        if action == 'checkout_pending': return []
        raise AssertionError(action)

    def test_signed_out_payment_endpoints_cannot_access_gateway(self):
        for path in ('order', 'reconcile'):
            self.assertEqual(self.client.post('/auth/subscription/' + path, json={}).status_code, 401)
        body = {'razorpay_order_id': 'order_fixture', 'razorpay_payment_id': 'pay_fixture', 'razorpay_signature': '0' * 64}
        self.assertEqual(self.client.post('/auth/subscription/verify', json=body).status_code, 401)
        self.rpc.assert_not_called()

    def test_cross_site_payment_posts_rejected(self):
        self.client.cookies.set(auth.SESSION_COOKIE, 'A' * 43)
        self.assertEqual(self.client.post('/auth/subscription/order', headers={'origin': 'https://evil.example'}, json={}).status_code, 403)
        self.rpc.assert_not_called()

    def test_webhook_does_not_require_cookie_or_browser_origin_but_needs_signature(self):
        self.client.headers.pop('origin')
        response = self.client.post('/auth/subscription/webhook', content=b'{}')
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.headers['cache-control'], 'no-store')
        self.rpc.assert_not_called()
        body = b'{"event":"payment.failed"}'
        response = self.client.post('/auth/subscription/webhook', content=body,
                                   headers={'x-razorpay-signature': signature(body, CONFIG.webhook_secret)})
        self.assertEqual(response.status_code, 200)

    def test_oversized_webhook_rejected(self):
        self.assertEqual(self.client.post('/auth/subscription/webhook', content=b' ' * 131073).status_code, 413)

    def test_rate_limit_and_temporary_password_block_checkout(self):
        self.client.cookies.set(auth.SESSION_COOKIE, 'A' * 43)
        self.rpc.side_effect = lambda action, data: ACCOUNT if action == 'session' else {'allowed': False}
        self.assertEqual(self.client.post('/auth/subscription/order', json={}).status_code, 429)
        self.rpc.side_effect = lambda action, data: {**ACCOUNT, 'must_change_password': True}
        self.assertEqual(self.client.post('/auth/subscription/order', json={}).status_code, 403)

    def test_disabled_flag_does_not_prevent_inflight_payment_recovery(self):
        self.client.cookies.set(auth.SESSION_COOKIE, 'A' * 43)
        with patch('account_auth.account_plan', return_value={'paid_active': True, 'access_allowed': True}):
            response = self.client.post('/auth/subscription/reconcile', json={})
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()['subscription']['paid_active'])

    def test_existing_access_prevents_creating_another_order(self):
        self.client.cookies.set(auth.SESSION_COOKIE, 'A' * 43)
        with patch('account_auth.account_plan', return_value={'access_allowed': True}):
            response = self.client.post('/auth/subscription/order', json={'amount': 1, 'account_id': OTHER, 'mode': 'live'})
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()['already_active'])
        self.assertNotIn('checkout_prepare', [call.args[0] for call in self.rpc.call_args_list])

    def test_verification_ignores_no_account_or_mode_overrides(self):
        self.client.cookies.set(auth.SESSION_COOKIE, 'A' * 43)
        body = {'razorpay_order_id': 'order_fixture', 'razorpay_payment_id': 'pay_fixture',
                'razorpay_signature': '0' * 64, 'account_id': OTHER, 'mode': 'live'}
        response = self.client.post('/auth/subscription/verify', json=body)
        self.assertEqual(response.status_code, 422)
        self.rpc.assert_not_called()

    def test_verified_callback_refreshes_access_for_signed_in_account(self):
        self.client.cookies.set(auth.SESSION_COOKIE, 'A' * 43)
        body = {'razorpay_order_id': 'order_fixture', 'razorpay_payment_id': 'pay_fixture',
                'razorpay_signature': signature(b'order_fixture|pay_fixture')}
        with patch('payment_service.Checkout.verify', return_value={'activated': True}) as verify:
            with patch('account_auth.account_plan', return_value={'paid_active': True, 'access_allowed': True}):
                response = self.client.post('/auth/subscription/verify', json=body)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()['subscription']['paid_active'])
        verify.assert_called_once_with(ACCOUNT, 'order_fixture', 'pay_fixture', body['razorpay_signature'])


if __name__ == '__main__':
    unittest.main()
