import unittest
from unittest.mock import Mock, patch

from fastapi import HTTPException
import requests
import main


class TransactionsFreshnessTests(unittest.TestCase):
    def request(self):
        return main.TransactionsRequest(from_date='01-11-2026', to_date='11-11-2026',
            dist_code=18, afso='42', fps_id=1842187, month=11, year=2026)

    def test_missing_reports_are_errors(self):
        for parser in (main.parse_transaction_report, main.parse_fps_transaction_details):
            with self.subTest(parser=parser.__name__), self.assertRaises(ValueError):
                parser('<html>Service unavailable</html>')

    def test_fresh_reads_metadata_and_no_fallback(self):
        daily = Mock(text='<table></table>', status_code=200)
        details = Mock(text='<table id="Report"></table>', status_code=200)
        with patch('main.requests.post', side_effect=[daily, details, daily, details,
                requests.Timeout('private')]) as post, \
             patch.object(main.EPOS_SESSION, 'post') as shared, \
             patch.object(main.EPOS_DETAILS_SESSION, 'post') as shared_details:
            for _ in range(2):
                result = main.fetch_transactions(self.request())
                self.assertEqual(result['requested_period'], self.request().model_dump())
                self.assertTrue(result['fetched_at'])
                self.assertEqual(result['summary']['transaction_count'], 0)
                self.assertNotIn('content_preview', result)
            with self.assertRaises(HTTPException):
                main.fetch_transactions(self.request())
            self.assertEqual(post.call_count, 5)
            shared.assert_not_called()
            shared_details.assert_not_called()
            for call in post.call_args_list:
                self.assertIn('no-store', call.kwargs['headers']['Cache-Control'])

    def test_missing_second_report_fails_whole_request(self):
        with patch('main.requests.post', side_effect=[
            Mock(text='<table></table>', status_code=200),
            Mock(text='<html>Error</html>', status_code=200),
        ]), self.assertRaises(HTTPException):
            main.fetch_transactions(self.request())
