"""Manual ₹99/30-day Razorpay Orders with a single-account live Preview pilot."""
import hashlib
import hmac
import json
import os
import re
from uuid import uuid4

import requests
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool

from account_auth import digest, live_pilot_account, live_pilot_enabled, rpc, session_user


router = APIRouter(prefix='/auth/subscription')
AMOUNT_PAISE = 9900
DAYS = 30
CURRENCY = 'INR'
ORDER_ID = re.compile(r'order_[A-Za-z0-9]+\Z')
PAYMENT_ID = re.compile(r'pay_[A-Za-z0-9]+\Z')


def payment_config(require_enabled=True):
    if require_enabled and os.getenv('PAYMENTS_ENABLED', 'false').lower() != 'true':
        raise HTTPException(503, 'Payments are not enabled yet.')
    mode = os.getenv('BILLING_MODE', 'test').strip().lower()
    key = os.getenv('RAZORPAY_KEY_ID', '')
    secret = os.getenv('RAZORPAY_KEY_SECRET', '')
    if (mode not in ('test', 'live') or not key.startswith(f'rzp_{mode}_')
            or not secret or 'REPLACE' in key.upper() or 'REPLACE' in secret.upper()
            or (mode == 'live' and (os.getenv('VERCEL_ENV', '').strip().lower() != 'preview'
                                   or os.getenv('VERCEL_GIT_COMMIT_REF', '') != 'feature/99-subscription'
                                   or (require_enabled and not live_pilot_enabled())))):
        raise HTTPException(503, 'Razorpay payments are not configured for this mode.')
    return mode, key, secret


def payment_user(request):
    account = session_user(request)
    if account.get('must_change_password'):
        raise HTTPException(403, 'Change your password before paying.')
    mode, _, _ = payment_config()
    if mode == 'live' and not live_pilot_account(account):
        raise HTTPException(403, 'This plan is not available for this account yet.')
    return account


def rate_limit(account):
    if not rpc('limit', {'key': digest('payments:' + account['id']), 'max': 20}).get('allowed'):
        raise HTTPException(429, 'Too many payment requests. Please try again later.')


def razor(method, path, payload=None, require_enabled=True):
    _, key, secret = payment_config(require_enabled=require_enabled)
    try:
        response = requests.request(method, f'https://api.razorpay.com/v1/{path}',
                                    auth=(key, secret), json=payload, timeout=(5, 15))
        response.raise_for_status()
        return response.json()
    except (requests.RequestException, ValueError):
        raise HTTPException(503, 'Payment provider is unavailable. Check payment status before retrying.') from None


def stored_order(order_id, account_id=None):
    mode, _, _ = payment_config()
    order = rpc('billing_order', {'order_id': order_id, 'mode': mode})
    if not order or (account_id and order['account_id'] != account_id):
        raise HTTPException(404, 'Payment order not found.')
    return order


def settle(order, payment):
    mode, _, _ = payment_config(require_enabled=False)
    if (payment.get('order_id') != order['order_id']
            or payment.get('amount') != order['amount_paise']
            or payment.get('currency') != CURRENCY
            or not PAYMENT_ID.fullmatch(str(payment.get('id', '')))):
        raise HTTPException(400, 'Payment details do not match the order.')
    if payment.get('status') != 'captured' or payment.get('captured') is not True:
        return {'ok': False, 'pending': True}
    if payment.get('amount_refunded', 0) != 0:
        raise HTTPException(409, 'This payment has a refund. Contact support.')
    return rpc('billing_activate', {
        'order_id': order['order_id'], 'payment_id': payment['id'], 'mode': mode})


@router.post('/order')
def create_order(request: Request):
    account = payment_user(request)
    rate_limit(account)
    mode, key, _ = payment_config()
    receipt = str(uuid4())
    rpc('billing_intent', {'receipt': receipt, 'account_id': account['id'], 'mode': mode})
    order = razor('POST', 'orders', {
        'amount': AMOUNT_PAISE, 'currency': CURRENCY, 'receipt': receipt,
        'partial_payment': False,
    })
    if (not ORDER_ID.fullmatch(str(order.get('id', '')))
            or order.get('amount') != AMOUNT_PAISE
            or order.get('currency') != CURRENCY
            or order.get('receipt') != receipt):
        raise HTTPException(502, 'Unexpected payment order response.')
    rpc('billing_attach', {'receipt': receipt, 'order_id': order['id'], 'mode': mode})
    return {'key': key, 'order_id': order['id'], 'amount': AMOUNT_PAISE,
            'currency': CURRENCY, 'mode': mode, 'contact': account['mobile'][-10:]}


class Verification(BaseModel):
    razorpay_order_id: str = Field(pattern=r'^order_[A-Za-z0-9]+$', max_length=100)
    razorpay_payment_id: str = Field(pattern=r'^pay_[A-Za-z0-9]+$', max_length=100)
    razorpay_signature: str = Field(pattern=r'^[a-fA-F0-9]{64}$')


@router.post('/verify')
def verify(body: Verification, request: Request):
    account = payment_user(request)
    rate_limit(account)
    order = stored_order(body.razorpay_order_id, account['id'])
    message = f"{order['order_id']}|{body.razorpay_payment_id}".encode()
    signature = hmac.new(payment_config()[2].encode(), message, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(signature, body.razorpay_signature.lower()):
        raise HTTPException(400, 'Invalid payment signature.')
    return settle(order, razor('GET', f'payments/{body.razorpay_payment_id}'))


@router.post('/reconcile')
def reconcile(request: Request):
    account = payment_user(request)
    rate_limit(account)
    mode, _, _ = payment_config()
    orders = rpc('billing_pending', {'account_id': account['id'], 'mode': mode})
    for order in orders:
        if not ORDER_ID.fullmatch(str(order.get('order_id', ''))):
            continue
        payments = razor('GET', f"orders/{order['order_id']}/payments")
        for payment in payments.get('items', []):
            if payment.get('status') == 'captured':
                settle(order, payment)
    return rpc('subscription_status', {'account_id': account['id'], 'mode': mode})


def process_webhook(raw, signature):
    mode, _, _ = payment_config(require_enabled=False)
    secret = os.getenv('RAZORPAY_WEBHOOK_SECRET', '')
    if not secret or 'REPLACE' in secret.upper():
        raise HTTPException(503, 'Webhook is not configured.')
    expected = hmac.new(secret.encode(), raw, hashlib.sha256).hexdigest()
    if not re.fullmatch(r'[a-fA-F0-9]{64}', signature or '') or not hmac.compare_digest(expected, signature.lower()):
        raise HTTPException(400, 'Invalid webhook signature.')
    try:
        event = json.loads(raw)
        if event.get('event') not in ('payment.captured', 'order.paid'):
            return {'ok': True}
        payment = event['payload']['payment']['entity']
        payment_id = payment['id']
        order_id = payment['order_id']
        if not PAYMENT_ID.fullmatch(payment_id) or not ORDER_ID.fullmatch(order_id):
            raise ValueError()
    except (ValueError, KeyError, TypeError, AttributeError):
        raise HTTPException(400, 'Invalid webhook payload.') from None
    # A Razorpay account may also serve other products; ignore their orders.
    order = rpc('billing_order', {'order_id': order_id, 'mode': mode})
    if not order:
        return {'ok': True}
    result = settle(order, razor('GET', f'payments/{payment_id}', require_enabled=False))
    if result.get('pending'):
        raise HTTPException(503, 'Payment capture is not confirmed yet.')
    return {'ok': True}


@router.post('/webhook')
async def webhook(request: Request):
    raw = bytearray()
    async for chunk in request.stream():
        raw.extend(chunk)
        if len(raw) > 262144:
            raise HTTPException(413, 'Webhook payload is too large.')
    return await run_in_threadpool(process_webhook, bytes(raw),
                                   request.headers.get('x-razorpay-signature', ''))
