"""Python-owned accounts. Supabase is storage; Supabase Auth is not used."""
import hashlib
import ipaddress
import logging
import os
import re
import secrets
from pathlib import Path
from uuid import UUID
from typing import Literal

import requests
from argon2 import PasswordHasher
from argon2.exceptions import VerificationError, InvalidHashError
from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException, Request, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, SecretStr, field_validator
from starlette.concurrency import run_in_threadpool

load_dotenv(Path(__file__).resolve().parent / '.env', override=False)
ALLOWED_ORIGINS = [x.strip().rstrip('/') for x in os.getenv(
    'APP_ALLOWED_ORIGINS', 'http://localhost:5173,http://127.0.0.1:5173,https://ration-stock.vercel.app'
).split(',') if x.strip()]
SECURE_COOKIES = bool(os.getenv('VERCEL')) or os.getenv('COOKIE_SECURE', 'false').lower() == 'true'
SESSION_COOKIE = '__Host-ration_session' if SECURE_COOKIES else 'ration_session'
DEVICE_COOKIE = '__Host-ration_device' if SECURE_COOKIES else 'ration_device'
SESSION_DAYS = 30
SUPPORT_NUMBER = os.getenv('SUPPORT_WHATSAPP', '919447645196')
PROTECTED_PATHS = {'/count', '/fps-stock', '/transactions', '/stock-register', '/ro-details',
                   '/ro-quantity-details', '/ration-card-details'}
hasher = PasswordHasher(time_cost=2, memory_cost=19456, parallelism=1)
_dummy_hash = hasher.hash(secrets.token_urlsafe(32))
router = APIRouter(prefix='/auth')


def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()


def rpc(action, data):
    url = os.getenv('SUPABASE_URL', '').rstrip('/')
    key = os.getenv('SUPABASE_SECRET_KEY', '')
    if not url.startswith('https://') or not key or 'REPLACE' in key:
        raise HTTPException(503, 'Account service is not configured yet.')
    try:
        function = 'ration_activity' if action in ('record_activity', 'dashboard') else 'ration_auth'
        response = requests.post(f'{url}/rest/v1/rpc/{function}',
            headers={'apikey': key, 'User-Agent': 'ration-stock-backend/1.0'},
            json={'p_action': action, 'p_data': data}, timeout=(5, 12))
        response.raise_for_status()
        return response.json()
    except (requests.RequestException, ValueError):
        # Never expose upstream response bodies, passwords, tokens, or database details.
        raise HTTPException(503, 'Account service is temporarily unavailable. Please try again.') from None


def valid_token(value):
    return value if value and re.fullmatch(r'[A-Za-z0-9_-]{43}', value) else None


def session_user(request):
    token = valid_token(request.cookies.get(SESSION_COOKIE))
    if not token:
        raise HTTPException(401, 'Please sign in to continue.')
    account = rpc('session', {'session_hash': digest(token)})
    if not account or not account.get('id'):
        raise HTTPException(401, 'Your session has ended. Please sign in again.')
    return account


async def account_gate(request, call_next):
    path = request.url.path.rstrip('/')
    protected = path in PROTECTED_PATHS
    is_auth = path.startswith('/auth/')
    if request.method == 'OPTIONS':
        return await call_next(request)
    try:
        if (protected or is_auth) and request.method not in ('GET', 'HEAD'):
            # Browser POSTs must carry an exact trusted origin (including the port).
            if request.headers.get('origin', '').rstrip('/') not in ALLOWED_ORIGINS:
                raise HTTPException(403, 'This request did not come from the app. Please reopen the app.')
        if protected:
            request.state.account = await run_in_threadpool(session_user, request)
            if request.state.account.get('must_change_password'):
                raise HTTPException(403, 'Please change your temporary password first.')
        response = await call_next(request)
        if protected and request.method == 'POST' and 200 <= response.status_code < 300:
            try:
                await run_in_threadpool(rpc, 'record_activity', {
                    'account_id': request.state.account['id'], 'feature': activity_feature(path, request)})
            except HTTPException:
                # Analytics failure must not break a successful feature request.
                logging.getLogger(__name__).warning('Activity recording unavailable')
    except HTTPException as exc:
        response = JSONResponse({'detail': exc.detail}, status_code=exc.status_code)
    if protected or is_auth:
        response.headers['Cache-Control'] = 'no-store'
    return response


def activity_feature(path, request):
    # Analytics hint only, never an authorization input.
    label = request.headers.get('x-app-feature', '')
    if path == '/transactions' and label in ('transactions', 'commission', 'monthComparison'):
        return label
    return path


def normalize_mobile(value):
    value = re.sub(r'[\s()+-]', '', str(value))
    if re.fullmatch(r'[6-9][0-9]{9}', value):
        value = '91' + value
    if not re.fullmatch(r'91[6-9][0-9]{9}', value):
        raise ValueError('Enter a valid Indian mobile number.')
    return value


class LoginBody(BaseModel):
    mobile: str = Field(max_length=20)
    password: SecretStr

    @field_validator('mobile')
    @classmethod
    def check_mobile(cls, value):
        return normalize_mobile(value)

    @field_validator('password')
    @classmethod
    def check_password_length(cls, value):
        if not 1 <= len(value.get_secret_value()) <= 128:
            raise ValueError('Password must be between 1 and 128 characters.')
        return value


class RegisterBody(LoginBody):
    fps_id: str = Field(pattern=r'^[0-9]{7}$')

    @field_validator('password')
    @classmethod
    def check_new_password(cls, value):
        if len(value.get_secret_value()) < 12:
            raise ValueError('Choose a password with at least 12 characters.')
        return value


def throttle(request, mobile):
    # The account bucket stays effective even if proxy/client IP information differs.
    client_ip = request.client.host if request.client else 'unknown'
    # Trust this header only behind Vercel's managed ingress, which overwrites it.
    if os.getenv('VERCEL'):
        try:
            client_ip = str(ipaddress.ip_address(request.headers.get('x-forwarded-for', '').split(',')[0].strip()))
        except ValueError:
            pass
    for bucket, limit in [(f'ip:{client_ip}', 30), (f'mobile:{mobile}', 10)]:
        if not rpc('limit', {'key': digest(bucket), 'max': limit}).get('allowed'):
            raise HTTPException(429, 'Too many attempts. Please wait 15 minutes and try again.')


def check_password(password, stored_hash):
    try:
        return hasher.verify(stored_hash or _dummy_hash, password)
    except (VerificationError, InvalidHashError):
        return False


def browser_label(request):
    ua = request.headers.get('user-agent', '')
    browser = 'Edge' if 'Edg' in ua else 'Firefox' if 'Firefox' in ua else 'Chrome' if 'Chrome' in ua else 'Safari' if 'Safari' in ua else 'Browser'
    platform = 'Android' if 'Android' in ua else 'iPhone/iPad' if any(x in ua for x in ('iPhone', 'iPad')) else 'Windows' if 'Windows' in ua else 'Mac' if 'Macintosh' in ua else 'device'
    return f'{browser} on {platform}'


def new_session(request):
    device = valid_token(request.cookies.get(DEVICE_COOKIE)) or secrets.token_urlsafe(32)
    token = secrets.token_urlsafe(32)
    return device, token, {'device_hash': digest(device), 'session_hash': digest(token),
        'label': browser_label(request), 'session_days': SESSION_DAYS}


def set_cookies(response, device, token):
    response.set_cookie(SESSION_COOKIE, token, max_age=SESSION_DAYS * 86400,
        httponly=True, secure=SECURE_COOKIES, samesite='lax', path='/')
    response.set_cookie(DEVICE_COOKIE, device, max_age=365 * 86400,
        httponly=True, secure=SECURE_COOKIES, samesite='lax', path='/')
    response.headers['Cache-Control'] = 'no-store'


@router.get('/me')
def me(request: Request):
    account = session_user(request)
    return {'account': {**account, 'is_owner': is_owner(account)}}


def is_owner(account):
    try:
        return UUID(str(account['id'])) == UUID(os.getenv('OWNER_ACCOUNT_ID', ''))
    except (ValueError, KeyError, TypeError):
        return False


@router.get('/admin/dashboard')
def dashboard(request: Request, page: int = 1, search: str = ''):
    account = session_user(request)
    if not is_owner(account) or account.get('must_change_password'):
        raise HTTPException(403, 'Owner access only.')
    if not 1 <= page <= 100000:
        raise HTTPException(400, 'Invalid page.')
    if len(search) > 30:
        raise HTTPException(400, 'Search is too long.')
    query = re.sub(r'[\s()+-]', '', search)
    if query and not re.fullmatch(r'[0-9]{1,20}', query):
        raise HTTPException(400, 'Search using a shop or mobile number.')
    result = rpc('dashboard', {'offset': (page - 1) * 50, 'search': query})
    if query and 'matching_accounts' not in result:
        raise HTTPException(503, 'Run the updated activity dashboard SQL to enable all-member search.')
    return result


@router.get('/support')
def support():
    return {'whatsapp': SUPPORT_NUMBER}


class OwnerResetBody(BaseModel):
    account_id: UUID
    mobile: str = Field(pattern=r'^91[6-9][0-9]{9}$')
    owner_password: SecretStr = Field(min_length=1, max_length=128)
    temporary_password: SecretStr = Field(min_length=12, max_length=128)
    reason: str = Field(min_length=10, max_length=350)
    ownership_verified: Literal[True]


@router.post('/admin/reset-password')
def owner_reset_password(body: OwnerResetBody, request: Request):
    owner = session_user(request)
    if not is_owner(owner) or owner.get('must_change_password'):
        raise HTTPException(403, 'Owner access only.')
    if str(body.account_id) == owner['id']:
        raise HTTPException(400, 'Use Change password for your own account.')
    reason = body.reason.strip()
    if len(reason) < 10:
        raise HTTPException(400, 'Please describe how ownership was verified.')
    throttle(request, owner['mobile'])
    credentials = rpc('find', {'mobile': owner['mobile']})
    if not credentials or not check_password(body.owner_password.get_secret_value(), credentials['password_hash']):
        raise HTTPException(401, 'Your owner password is incorrect.')
    target = rpc('find', {'mobile': body.mobile})
    if not target or str(target['id']) != str(body.account_id):
        raise HTTPException(404, 'Account details changed. Refresh the dashboard.')
    if target.get('disabled'):
        raise HTTPException(400, 'This account is disabled. Password reset will not enable it.')
    temporary = body.temporary_password.get_secret_value()
    if temporary == body.owner_password.get_secret_value():
        raise HTTPException(400, 'Do not use your own password as the temporary password.')
    result = rpc('reset_password', {'mobile': body.mobile,
        'password_hash': hasher.hash(temporary),
        'reason': f"Dashboard owner {owner['id']}: {reason}"})
    if not result.get('ok'):
        raise HTTPException(409, 'Reset could not be completed. Refresh and try again.')
    return {'ok': True}


@router.post('/register')
def register(body: RegisterBody, request: Request, response: Response):
    throttle(request, body.mobile)
    device, token, session = new_session(request)
    result = rpc('register', {**session, 'mobile': body.mobile, 'fps_id': body.fps_id,
        'password_hash': hasher.hash(body.password.get_secret_value())})
    if not result.get('ok'):
        raise HTTPException(409, 'Unable to create this account. Try signing in or contact support.')
    set_cookies(response, device, token)
    return {'ok': True}


@router.post('/login')
def login(body: LoginBody, request: Request, response: Response):
    throttle(request, body.mobile)
    account = rpc('find', {'mobile': body.mobile})
    matches = check_password(body.password.get_secret_value(), account.get('password_hash') if account else None)
    if not account or not matches or account.get('disabled'):
        raise HTTPException(401, 'Mobile number or password is incorrect.')
    device, token, session = new_session(request)
    result = rpc('open_session', {**session, 'account_id': account['id'],
        'expected_hash': account['password_hash']})
    code = result.get('error')
    if code or not result.get('ok'):
        raise HTTPException(401, 'Sign-in could not be completed. Please try again.')
    set_cookies(response, device, token)
    return {'ok': True}


@router.post('/logout')
def logout(request: Request, response: Response):
    token = valid_token(request.cookies.get(SESSION_COOKIE))
    if token:
        rpc('logout', {'session_hash': digest(token)})
    response.delete_cookie(SESSION_COOKIE, httponly=True, secure=SECURE_COOKIES, samesite='lax', path='/')
    return {'ok': True}


@router.get('/devices')
def devices(request: Request):
    session_user(request)
    return rpc('devices', {'session_hash': digest(request.cookies[SESSION_COOKIE])})


class ChangePasswordBody(BaseModel):
    current_password: SecretStr
    new_password: SecretStr

    @field_validator('current_password', 'new_password')
    @classmethod
    def bounded_password(cls, value):
        if not 1 <= len(value.get_secret_value()) <= 128:
            raise ValueError('Invalid password length.')
        return value


@router.post('/change-password')
def change_password(body: ChangePasswordBody, request: Request, response: Response):
    user = session_user(request)
    throttle(request, user['mobile'])
    new_password = body.new_password.get_secret_value()
    if len(new_password) < 12 or new_password == body.current_password.get_secret_value():
        raise HTTPException(400, 'Choose a different password with at least 12 characters.')
    account = rpc('find', {'mobile': user['mobile']})
    if not account or not check_password(body.current_password.get_secret_value(), account['password_hash']):
        raise HTTPException(401, 'Current password is incorrect.')
    new_token = secrets.token_urlsafe(32)
    result = rpc('change_password', {'account_id': user['id'], 'expected_hash': account['password_hash'],
        'password_hash': hasher.hash(new_password), 'session_hash': digest(request.cookies[SESSION_COOKIE]),
        'new_session_hash': digest(new_token), 'session_days': SESSION_DAYS})
    if not result.get('ok'):
        raise HTTPException(401, 'Please sign in again.')
    response.set_cookie(SESSION_COOKIE, new_token, max_age=SESSION_DAYS * 86400,
        httponly=True, secure=SECURE_COOKIES, samesite='lax', path='/')
    return {'ok': True}
