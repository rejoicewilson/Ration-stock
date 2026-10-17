"""Razorpay checkout verification. Database access is injected by the account router."""
import hashlib
import hmac
import json
import os
import re
from dataclasses import dataclass, field
from uuid import UUID, uuid4

import requests
from fastapi import HTTPException

PRICE_PAISE = 9900
CURRENCY = 'INR'
API_ROOT = 'https://api.razorpay.com/v1'


def billing_mode():
    mode = os.getenv('BILLING_MODE', 'test')
    if mode not in ('test', 'live'):
        raise HTTPException(503, 'Payment mode is not configured correctly.')
    return mode


@dataclass(frozen=True)
class Settings:
    mode: str
    key_id: str
    key_secret: str = field(repr=False)
    webhook_secret: str = field(repr=False)


def settings(*, enabled=False):
    if enabled and os.getenv('PAYMENTS_ENABLED', 'false').lower() != 'true':
        raise HTTPException(503, 'Payments are not available yet. Please try again later.')
    mode = billing_mode()
    key_id = os.getenv('RAZORPAY_KEY_ID', '')
    secret = os.getenv('RAZORPAY_KEY_SECRET', '')
    webhook = os.getenv('RAZORPAY_WEBHOOK_SECRET', '')
    if not re.fullmatch(rf'rzp_{mode}_[A-Za-z0-9]+', key_id) or not secret or 'REPLACE' in secret:
        raise HTTPException(503, 'Payments are not configured yet.')
    if enabled and mode == 'live' and not webhook:
        raise HTTPException(503, 'Live payment notifications must be configured first.')
    return Settings(mode, key_id, secret, webhook)


def payments_ready():
    try:
        settings(enabled=True)
        return True
    except HTTPException:
        return False


class GatewayError(HTTPException):
    def __init__(self, definitive=False):
        super().__init__(503, 'Payment service is unavailable. Check payment status before paying again.')
        self.definitive = definitive


def gateway(config, method, path, **kwargs):
    try:
        response = requests.request(method, f'{API_ROOT}/{path}',
            auth=(config.key_id, config.key_secret), timeout=(3, 10), **kwargs)
        if not response.ok:
            raise GatewayError(response.status_code in (400, 401, 403, 404, 422))
        data = response.json()
        if not isinstance(data, dict):
            raise ValueError('Invalid response')
        return data
    except (requests.RequestException, ValueError):
        raise GatewayError() from None


def identifier(value, prefix):
    if not isinstance(value, str) or not re.fullmatch(rf'{prefix}_[A-Za-z0-9]{{1,80}}', value):
        raise HTTPException(400, 'Invalid payment reference.')
    return value


def valid_signature(message, signature, secret):
    return (isinstance(signature, str) and bool(re.fullmatch(r'[0-9a-f]{64}', signature))
            and hmac.compare_digest(hmac.new(secret.encode(), message, hashlib.sha256).hexdigest(), signature))


class Checkout:
    def __init__(self, store, config):
        self.store = store
        self.config = config

    def db(self, action, **data):
        return self.store('checkout_' + action, {**data, 'mode': self.config.mode, 'key_id': self.config.key_id})

    def validate_order(self, order, row):
        identifier(order.get('id'), 'order')
        if (order.get('receipt') != str(row['receipt']) or order.get('amount') != PRICE_PAISE
                or order.get('currency') != CURRENCY or row.get('amount_paise') != PRICE_PAISE
                or (row.get('order_id') is not None and order['id'] != row['order_id'])):
            raise HTTPException(400, 'Payment order does not match this plan.')

    def attach(self, order, row):
        self.validate_order(order, row)
        return self.db('attach', receipt=row['receipt'], account_id=row['account_id'], order_id=order['id'])

    def recover_order(self, row):
        if row.get('order_id'):
            order = gateway(self.config, 'GET', f'orders/{identifier(row["order_id"], "order")}')
            self.validate_order(order, row)
            return order
        data = gateway(self.config, 'GET', 'orders', params={'receipt': str(row['receipt']), 'count': 100})
        items = data.get('items')
        if not isinstance(items, list):
            raise GatewayError()
        matches = [item for item in items if isinstance(item, dict) and item.get('receipt') == str(row['receipt'])]
        if len(matches) > 1:
            raise HTTPException(409, 'Payment needs review. Please contact support before paying again.')
        if matches:
            self.attach(matches[0], row)
            return matches[0]
        return None

    def start(self, account):
        row = self.db('prepare', account_id=account['id'], receipt=str(uuid4()))
        if row.get('new_intent'):
            try:
                order = gateway(self.config, 'POST', 'orders', json={
                    'amount': PRICE_PAISE, 'currency': CURRENCY, 'receipt': str(row['receipt']),
                    'partial_payment': False,
                    'notes': {'account_id': str(account['id']), 'plan': 'ration_30_days', 'mode': self.config.mode},
                })
            except GatewayError as exc:
                if exc.definitive:
                    self.db('creation_failed', account_id=account['id'], receipt=row['receipt'])
                raise
            self.attach(order, row)
        else:
            order = self.recover_order(row)
            if order is None:
                raise HTTPException(409, 'An earlier payment order is being checked. Please check payment status before paying again.')
            attempts = gateway(self.config, 'GET', f'orders/{order["id"]}/payments')
            if not isinstance(attempts.get('items'), list):
                raise GatewayError()
            if order.get('status') == 'paid' or any(
                    item.get('status') in ('authorized', 'captured') for item in attempts['items'] if isinstance(item, dict)):
                raise HTTPException(409, 'An earlier payment is being confirmed. Please check payment status before paying again.')
        return {'order_id': order['id'], 'key_id': self.config.key_id, 'mode': self.config.mode,
                'amount': PRICE_PAISE, 'currency': CURRENCY, 'prefill_contact': account.get('mobile', '')}

    def lookup(self, order_id, account_id=None):
        order_id = identifier(order_id, 'order')
        row = self.db('get', order_id=order_id, account_id=account_id)
        if row:
            return row
        # Recover a successful gateway create whose database attachment timed out.
        order = gateway(self.config, 'GET', f'orders/{order_id}')
        try:
            receipt = str(UUID(order.get('receipt', '')))
        except (ValueError, TypeError, AttributeError):
            return None
        row = self.db('get', receipt=receipt, account_id=account_id)
        return self.attach(order, row) if row else None

    def activate(self, row, payment):
        identifier(payment.get('id'), 'pay')
        if (payment.get('order_id') != row['order_id'] or payment.get('amount') != PRICE_PAISE
                or payment.get('currency') != CURRENCY or row.get('amount_paise') != PRICE_PAISE):
            raise HTTPException(400, 'Payment does not match this plan.')
        if payment.get('status') != 'captured' or payment.get('captured') is not True:
            return {'activated': False, 'pending': True}
        if payment.get('amount_refunded', 0) != 0 or payment.get('refund_status') is not None:
            raise HTTPException(409, 'This payment has been refunded. Please contact support.')
        result = self.db('activate', account_id=row['account_id'], receipt=row['receipt'],
                         order_id=row['order_id'], payment_id=payment['id'], amount_paise=PRICE_PAISE, currency=CURRENCY)
        return {'activated': True, 'pending': False, 'paid_until': result['paid_until']}

    def verify(self, account, order_id, payment_id, signature):
        identifier(payment_id, 'pay')
        row = self.lookup(order_id, account['id'])
        if not row:
            raise HTTPException(404, 'Payment order not found for this account.')
        if not valid_signature(f'{row["order_id"]}|{payment_id}'.encode(), signature, self.config.key_secret):
            raise HTTPException(400, 'Payment signature could not be verified.')
        order = gateway(self.config, 'GET', f'orders/{row["order_id"]}')
        self.validate_order(order, row)
        payment = gateway(self.config, 'GET', f'payments/{payment_id}')
        if payment.get('id') != payment_id:
            raise HTTPException(400, 'Payment reference mismatch.')
        return self.activate(row, payment)

    def reconcile(self, account):
        rows = self.db('pending', account_id=account['id'])
        if not isinstance(rows, list):
            raise GatewayError()
        activated = False
        for row in rows:
            order = self.recover_order(row)
            if order is None:
                continue
            row = {**row, 'order_id': order['id']}
            payments = gateway(self.config, 'GET', f'orders/{order["id"]}/payments')
            if not isinstance(payments.get('items'), list):
                raise GatewayError()
            for item in payments['items']:
                if isinstance(item, dict) and item.get('status') == 'captured':
                    payment_id = identifier(item.get('id'), 'pay')
                    payment = gateway(self.config, 'GET', f'payments/{payment_id}')
                    if payment.get('id') != payment_id:
                        raise HTTPException(400, 'Payment reference mismatch.')
                    activated = self.activate(row, payment)['activated'] or activated
        return {'activated': activated}

    def webhook(self, raw_body, signature):
        if not self.config.webhook_secret:
            raise HTTPException(503, 'Payment notifications are not configured yet.')
        if not valid_signature(raw_body, signature, self.config.webhook_secret):
            raise HTTPException(400, 'Invalid payment notification signature.')
        try:
            event = json.loads(raw_body)
            if not isinstance(event, dict):
                raise ValueError('Invalid event')
            if event.get('event') not in ('payment.captured', 'order.paid'):
                return {'ok': True, 'ignored': True}
            payload = event['payload']
            if event['event'] == 'payment.captured':
                entity = payload['payment']['entity']
                payment_id = identifier(entity['id'], 'pay')
                order_id = identifier(entity['order_id'], 'order')
            else:
                order_id = identifier(payload['order']['entity']['id'], 'order')
                payment_id = None
        except (ValueError, KeyError, TypeError):
            raise HTTPException(400, 'Invalid payment notification.') from None
        row = self.lookup(order_id)
        if not row:
            return {'ok': True, 'ignored': True}
        order = gateway(self.config, 'GET', f'orders/{order_id}')
        self.validate_order(order, row)
        if payment_id is None:
            payments = gateway(self.config, 'GET', f'orders/{order_id}/payments')
            items = payments.get('items')
            if not isinstance(items, list):
                raise GatewayError()
            captured = [item for item in items if isinstance(item, dict) and item.get('status') == 'captured']
            if not captured:
                raise HTTPException(503, 'Payment capture is still being checked.')
            payment_id = identifier(captured[0].get('id'), 'pay')
        payment = gateway(self.config, 'GET', f'payments/{payment_id}')
        if payment.get('id') != payment_id:
            raise HTTPException(400, 'Payment reference mismatch.')
        result = self.activate(row, payment)
        if not result['activated']:
            raise HTTPException(503, 'Payment capture is still being checked.')
        return {'ok': True}
