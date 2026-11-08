import logging
import unittest
from unittest.mock import patch
from unittest.mock import Mock
import requests

from fastapi import HTTPException
from fastapi.testclient import TestClient

import account_auth as auth
from main import app


class LedgerTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        self.client.headers['origin'] = auth.ALLOWED_ORIGINS[0]
        self.client.cookies.set(auth.SESSION_COOKIE, 'A' * 43)
        self.owner = '00000000-0000-0000-0000-000000000001'
        self.mock = patch('account_auth.rpc')
        self.rpc = self.mock.start()
        self.addCleanup(self.mock.stop)
        self.rpc.side_effect = lambda action, data: {'id': self.owner} if action == 'session' else {'ok': True}
        self.plan = patch('account_auth.account_plan', return_value={'access_allowed': True})
        self.plan.start()
        self.addCleanup(self.plan.stop)
        self.entry = {'card_number': '1234567890', 'kind': 'owed_to_shop', 'amount_paise': 200,
                      'request_id': '00000000-0000-0000-0000-000000000002'}

    def test_all_routes_require_login_and_plan(self):
        paths = ('customers', 'customer', 'entries', 'reverse')
        self.client.cookies.clear()
        for path in paths:
            response = self.client.post('/ledger/' + path, json={})
            self.assertEqual(response.status_code, 401)
            self.assertEqual(response.headers['cache-control'], 'no-store')
        self.rpc.assert_not_called()
        self.client.cookies.set(auth.SESSION_COOKIE, 'A' * 43)
        with patch('account_auth.account_plan', return_value={'access_allowed': False}):
            for path in paths:
                self.assertEqual(self.client.post('/ledger/' + path, json={}).status_code, 402)
        self.assertFalse(any(c.args[0].startswith('ledger_') for c in self.rpc.call_args_list))

    def test_temporary_password_and_origin_enforced(self):
        self.rpc.side_effect = lambda action, data: {'id': self.owner, 'must_change_password': True}
        self.assertEqual(self.client.post('/ledger/customers', json={}).status_code, 403)
        self.rpc.reset_mock()
        self.assertEqual(self.client.post('/ledger/entries', json=self.entry, headers={'origin': 'https://evil.example'}).status_code, 403)
        self.rpc.assert_not_called()

    def test_account_identity_server_owned_and_no_personal_analytics(self):
        response = self.client.post('/ledger/entries', json={**self.entry, 'customer_name': 'Test', 'note': 'Private note'})
        self.assertEqual(response.status_code, 200)
        calls = [c for c in self.rpc.call_args_list if c.args[0] == 'ledger_add']
        self.assertEqual(calls[0].args[1]['account_id'], self.owner)
        analytics = [c.args[1] for c in self.rpc.call_args_list if c.args[0] == 'record_activity']
        self.assertEqual(analytics, [{'account_id': self.owner, 'feature': '/ledger/entries'}])
        response = self.client.post('/ledger/entries', json={**self.entry, 'account_id': 'attacker'})
        self.assertEqual(response.status_code, 422)
        self.assertNotIn('attacker', response.text)

    def test_strict_paise_card_and_payload_validation(self):
        for fields in ({'amount_paise': 1.5}, {'amount_paise': True}, {'amount_paise': '200'},
                       {'amount_paise': 0}, {'amount_paise': -1}, {'amount_paise': 10000001},
                       {'card_number': '123'}, {'kind': 'reversal'}, {'request_id': 'bad'},
                       {'note': 'x' * 201}):
            with self.subTest(fields=fields):
                self.assertEqual(self.client.post('/ledger/entries', json={**self.entry, **fields}).status_code, 422)
        self.assertFalse(any(c.args[0].startswith('ledger_') for c in self.rpc.call_args_list))

    def test_list_detail_and_reverse_use_expected_actions(self):
        cases = [('customers', {'search': '123', 'page': 2}, 'ledger_list'),
                 ('customer', {'card_number': '1234567890'}, 'ledger_detail'),
                 ('reverse', {'card_number': '1234567890', 'entry_id': self.entry['request_id'],
                              'request_id': self.entry['request_id'], 'reason': 'Mistake'}, 'ledger_reverse')]
        for path, payload, action in cases:
            self.rpc.reset_mock()
            response = self.client.post('/ledger/' + path, json=payload)
            self.assertEqual(response.status_code, 200)
            self.assertEqual([c.args[0] for c in self.rpc.call_args_list if c.args[0].startswith('ledger_')], [action])

    def test_list_status_is_validated_and_forwarded(self):
        for status in ('open', 'closed', 'all'):
            self.rpc.reset_mock()
            self.assertEqual(self.client.post('/ledger/customers', json={'status': status}).status_code, 200)
            data = [c.args[1] for c in self.rpc.call_args_list if c.args[0] == 'ledger_list'][0]
            self.assertEqual(data['status'], status)
            self.assertEqual(data['account_id'], self.owner)
        self.assertEqual(self.client.post('/ledger/customers', json={'status': 'invalid'}).status_code, 422)

    def test_service_failure_and_conflict_do_not_claim_saved(self):
        def reply(action, data):
            if action == 'session': return {'id': self.owner}
            raise HTTPException(503, 'Temporarily unavailable')
        self.rpc.side_effect = reply
        self.assertEqual(self.client.post('/ledger/entries', json=self.entry).status_code, 503)
        for code, status in [('not_found', 404), ('request_conflict', 409), ('settlement_exceeds_balance', 409), ('already_reversed', 409)]:
            self.rpc.side_effect = lambda action, data: {'id': self.owner} if action == 'session' else {'error': code}
            self.assertEqual(self.client.post('/ledger/entries', json=self.entry).status_code, status)

    def test_rpc_routes_only_ledger_to_new_function(self):
        self.mock.stop()
        with patch.dict('os.environ', {'SUPABASE_URL': 'https://fixture.example', 'SUPABASE_SECRET_KEY': 'fixture'}), patch('account_auth.requests.post') as post:
            post.return_value.json.return_value = {'ok': True}
            auth.rpc('ledger_list', {'account_id': self.owner})
            self.assertTrue(post.call_args.args[0].endswith('/rpc/ration_balance_ledger'))

    def test_upstream_diagnostics_never_log_private_data(self):
        self.mock.stop()
        response = Mock(status_code=400)
        response.json.return_value = {'code': '42P01', 'message': 'PRIVATE_DATABASE_MESSAGE', 'details': 'PRIVATE_DETAIL'}
        response.raise_for_status.side_effect = requests.HTTPError('PRIVATE_EXCEPTION')
        with patch.dict('os.environ', {'SUPABASE_URL': 'https://fixture.example', 'SUPABASE_SECRET_KEY': 'PRIVATE_KEY'}), patch('account_auth.requests.post', return_value=response), patch.object(logging.getLogger('ration-backend'), 'warning') as warning:
            with self.assertRaises(HTTPException) as error:
                auth.rpc('ledger_list', {'account_id': self.owner, 'card_number': '1234567890', 'note': 'PRIVATE_NOTE'})
            self.assertEqual(error.exception.status_code, 503)
            message = warning.call_args.args[0] % warning.call_args.args[1:]
            self.assertIn('42P01', message)
            self.assertIn('ledger_list', message)
            for private in ('PRIVATE_', self.owner, '1234567890'):
                self.assertNotIn(private, message)


if __name__ == '__main__':
    logging.disable(logging.CRITICAL)
    unittest.main()
