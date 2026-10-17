import unittest
from unittest.mock import Mock, patch

import requests
from fastapi import HTTPException

import main


class FeatureErrorTests(unittest.TestCase):
    def cases(self):
        stock = main.StockRequest(fps_id=1842187, month=10, year=2026)
        return [
            (main.get_fps_stock, stock, 'main.requests.post', 'EPOS_UNAVAILABLE'),
            (main.get_raw_rice_cb_sum, stock, 'main.requests.post', 'EPOS_UNAVAILABLE'),
            (main.fetch_transactions, main.TransactionsRequest(from_date='01/10/2026', to_date='10/10/2026',
                dist_code=18, afso='42', fps_id=1842187, month=10, year=2026), 'main.EPOS_SESSION.post', 'EPOS_UNAVAILABLE'),
            (main.get_stock_register, main.StockRegisterRequest(dist_code=18, office_code=42,
                fps_id=1842187, month=10, year=2026), 'main.EPOS_SESSION.post', 'EPOS_UNAVAILABLE'),
            (main.get_ro_details, main.RoDetailsRequest(month=10, year=2026, shop_no=1842187,
                dist_code=18, depot_id='1'), 'main.EPOS_SESSION.get', 'SCM_UNAVAILABLE'),
            (main.get_ro_quantity_details, main.RoQuantityDetailsRequest(ro_no='RO-1',
                release_order_id_aso='1'), 'main.EPOS_SESSION.get', 'SCM_UNAVAILABLE'),
            (main.get_ration_card_details, main.RationCardDetailsRequest(src_no='1234567890',
                month=10, year=2026), 'main.EPOS_DETAILS_SESSION.post', 'EPOS_UNAVAILABLE'),
        ]

    def test_upstream_details_stay_in_logs_not_public_errors(self):
        for handler, request, target, code in self.cases():
            for failure in (requests.ConnectionError, requests.Timeout):
                with self.subTest(handler=handler.__name__, failure=failure.__name__), \
                     patch(target, side_effect=failure('PRIVATE_HOST ConnectTimeoutError 0x12345')), \
                     patch.object(main.logger, 'exception') as log:
                    with self.assertRaises(HTTPException) as caught:
                        handler(request)
                    self.assertEqual(caught.exception.detail['code'], code)
                    self.assertNotIn('PRIVATE_HOST', str(caught.exception.detail))
                    self.assertNotIn('ConnectTimeoutError', str(caught.exception.detail))
                    self.assertGreaterEqual(caught.exception.status_code, 500)
                    log.assert_called_once()

    def test_unexpected_parse_error_is_not_mislabeled_as_epos_outage(self):
        response = Mock(text='<html></html>', status_code=200)
        with patch('main.EPOS_SESSION.post', return_value=response), \
             patch('main.parse_transaction_report', side_effect=ValueError('PRIVATE_PARSE_DETAIL')), \
             patch.object(main.logger, 'exception') as log:
            transaction_case = self.cases()[2]
            with self.assertRaises(HTTPException) as caught:
                transaction_case[0](transaction_case[1])
            self.assertEqual(caught.exception.detail['code'], 'FEATURE_ERROR')
            self.assertNotIn('PRIVATE_PARSE_DETAIL', str(caught.exception.detail))
            log.assert_called_once()


if __name__ == '__main__':
    unittest.main()
