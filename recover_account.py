"""Operator-only recovery. Never expose this command through a public endpoint."""
from getpass import getpass
from fastapi import HTTPException
from account_auth import normalize_mobile, hasher, rpc


def main():
    print('Verify ownership independently before resetting an account.')
    print('A claimed mobile/shop number alone is NOT proof of ownership.')
    mobile = normalize_mobile(input('Registered mobile: '))
    reason = input('Verification method and support reference (no secrets): ').strip()
    if len(reason) < 10:
        raise ValueError('Record a meaningful verification reason.')
    password = getpass('Temporary password (12–128 characters): ')
    if not 12 <= len(password) <= 128 or password != getpass('Repeat temporary password: '):
        raise ValueError('Password length or confirmation is invalid.')
    if input('Revoke all sessions and reset this account? Type RESET: ') != 'RESET':
        print('Cancelled. No changes made.')
        return
    result = rpc('reset_password', {'mobile': mobile, 'reason': reason,
                                   'password_hash': hasher.hash(password)})
    if not result.get('ok'):
        raise ValueError('Account was not found; no reset performed.')
    print('Reset complete. All sessions revoked. Password change required at next sign-in.')


if __name__ == '__main__':
    try:
        main()
    except (ValueError, HTTPException) as exc:
        print(exc.detail if isinstance(exc, HTTPException) else str(exc))
        raise SystemExit(1)
