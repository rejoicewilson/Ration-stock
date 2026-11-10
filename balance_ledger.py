"""Account-private, manually entered customer balances. No ePoS integration."""
import logging
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field

import account_auth as auth

router = APIRouter(prefix='/ledger')


class LedgerBody(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)


class ListBody(LedgerBody):
    search: str = Field(default='', max_length=80)
    page: int = Field(default=1, ge=1, le=10000, strict=True)
    status: Literal['open', 'closed', 'all'] = 'all'


class CardBody(LedgerBody):
    card_number: str = Field(pattern=r'^[0-9]{10}$')
    page: int = Field(default=1, ge=1, le=10000, strict=True)


class EntryBody(LedgerBody):
    card_number: str = Field(pattern=r'^[0-9]{10}$')
    customer_name: str = Field(default='', max_length=80)
    customer_mobile: str = Field(default='', pattern=r'^(?:[6-9][0-9]{9})?$')
    kind: Literal['owed_to_shop', 'owed_to_customer', 'received', 'returned']
    amount_paise: int = Field(ge=1, le=10000000, strict=True)
    note: str = Field(default='', max_length=200)
    request_id: UUID


class ReverseBody(LedgerBody):
    card_number: str = Field(pattern=r'^[0-9]{10}$')
    entry_id: UUID
    reason: str = Field(min_length=3, max_length=200)
    request_id: UUID


def execute(request, action, body):
    # Middleware owns authentication, password-change and subscription enforcement.
    data = {**body.model_dump(mode='json'), 'account_id': request.state.account['id']}
    try:
        result = auth.rpc('ledger_' + action, data)
    except HTTPException as exc:
        if exc.status_code >= 500:
            logging.getLogger('ration-backend').warning(
                'ledger_operation_unavailable request_id=%s action=%s status=%s',
                getattr(request.state, 'request_id', 'unknown'), action, exc.status_code)
        raise
    if not isinstance(result, dict):
        raise HTTPException(503, 'Your notebook is temporarily unavailable. Please try again.')
    errors = {
        'not_found': (404, 'This customer or entry was not found in your notebook.'),
        'invalid': (400, 'Please check the card number, amount and entry details.'),
        'settlement_exceeds_balance': (409, 'The balance has changed. Refresh the page and check the amount.'),
        'already_reversed': (409, 'This entry has already been corrected. Refresh the page.'),
        'request_conflict': (409, 'This save request was already used for different details. Refresh before continuing.'),
        'unauthorized': (401, 'Please sign in again to continue.'),
    }
    if result.get('error'):
        status, message = errors.get(result['error'], (503, 'Your notebook is temporarily unavailable.'))
        raise HTTPException(status, message)
    return result


@router.post('/customers')
def customers(body: ListBody, request: Request):
    return execute(request, 'list', body)


@router.post('/customer')
def customer(body: CardBody, request: Request):
    return execute(request, 'detail', body)


@router.post('/entries')
def add_entry(body: EntryBody, request: Request):
    return execute(request, 'add', body)


@router.post('/reverse')
def reverse_entry(body: ReverseBody, request: Request):
    return execute(request, 'reverse', body)
