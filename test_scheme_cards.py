import unittest

from main import summarize_fps_transaction_details


class SchemeCardTests(unittest.TestCase):
    def test_unique_cards_by_scheme_and_date(self):
        def row(scheme, card, date="05-08-2026"):
            return {"scheme": scheme, "rc_no": card, "date": date, "commodity_quantities": {}}

        summary = summarize_fps_transaction_details([
            row("AAY", "123-456"), row("AAY", "123456"),
            row(" phh ", "789"), row("PHH", "789"), row("PHH", "123456"),
            row("NPS", "111"), row("NPNS", "222"), row("NPI", "333"),
            row("NPI", ""), row("NPI", "-"), row("NPI", None),
            row("AAY", "999", "01-09-2026"),
        ], "01-08-2026", "31-08-2026")
        self.assertEqual(summary["scheme_card_counts"], {"AAY": 1, "PHH": 2, "NPS": 1, "NPNS": 1, "NPI": 1})
        self.assertEqual(summary["card_count"], 5)
        self.assertEqual(summary["transaction_count"], 11)
        self.assertEqual(summary["scheme_transaction_counts"]["NPI"], 4)

    def test_empty(self):
        summary = summarize_fps_transaction_details([], "01-08-2026", "31-08-2026")
        self.assertEqual(summary["scheme_card_counts"], {})
        self.assertEqual(summary["card_count"], 0)


if __name__ == "__main__":
    unittest.main()
