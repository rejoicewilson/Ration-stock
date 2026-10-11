"""Regression checks for backend classification and the actual frontend formula."""
import json
import subprocess
import unittest
from pathlib import Path

from main import summarize_fps_transaction_details


class OmssCommissionTests(unittest.TestCase):
    def calculate(self, rows):
        summary = summarize_fps_transaction_details(rows, "01-08-2026", "07-09-2026")
        script = """
const fs = require('node:fs');
const src = fs.readFileSync('react _frontend/src/App.jsx', 'utf8');
const fn = src.slice(src.indexOf('const calculateCommission ='), src.indexOf('const formatNumber ='));
const calculate = new Function('formatNumber', fn + '; return calculateCommission;')(String);
console.log(JSON.stringify(calculate(JSON.parse(fs.readFileSync(0, 'utf8')))));
"""
        result = subprocess.run(
            ["node", "-e", script], input=json.dumps(summary), text=True,
            capture_output=True, check=True, cwd=Path(__file__).parent,
        )
        return summary, json.loads(result.stdout)

    def row(self, scheme, quantities, date="03-08-2026"):
        return {"scheme": scheme, "date": date, "commodity_quantities": quantities}

    def test_special_rate_and_scheme_boundaries(self):
        for scheme in ["NPS", "NPNS", "NPI", "PHH", "AAY"]:
            with self.subTest(scheme=scheme):
                summary, result = self.calculate([self.row(scheme, {
                    "OMSS SPL.BR (Kgs)": "10", "BRF (Kgs)": "20",
                    "BR F. SPL (Kgs)": "5", "OMSS BR (Kgs)": "7",
                })])
                self.assertEqual(summary["scheme_omss_spl_rice_totals"], {scheme: 10})
                self.assertEqual(result["eligibleKg"], 42)
                self.assertEqual(result["commission"], 6800)
                expected = 91 if scheme in ["NPS", "NPNS", "NPI"] else 27 if scheme == "PHH" else 0
                self.assertEqual(result["alreadyCollectedAmount"], expected)

    def test_august_reconciliation(self):
        rows = [
            self.row("NPS", {"OMSS SPL.BR (Kgs)": 550, "BRF (Kgs)": 1361, "Atta": 13, "Wheat": 175}),
            self.row("NPNS", {"OMSS SPL.BR (Kgs)": 600, "BRF (Kgs)": 960, "Atta": 19, "Wheat": 139}),
            self.row("PHH", {"Atta": 805, "RRF": 7446, "Wheat": 179}),
            self.row("AAY", {"Atta": 72, "RRF": 1920, "Wheat": 207}),
        ]
        _, result = self.calculate(rows)
        self.assertEqual(result["alreadyCollectedAmount"], 10049)
        self.assertEqual(result["commission"], 40892)

    def test_no_omss_and_date_filter(self):
        rows = [self.row("NPS", {"BRF": 1172, "Atta": 115, "Wheat": 225}),
                self.row("NPNS", {"BRF": 624, "Atta": 93}),
                self.row("PHH", {"Atta": 804}),
                self.row("PHH", {"OMSS SPL.BR": 100}, "08-09-2026")]
        summary, result = self.calculate(rows)
        self.assertEqual(summary["scheme_omss_spl_rice_totals"], {})
        self.assertEqual(result["alreadyCollectedAmount"], 6066)

    def test_empty(self):
        _, result = self.calculate([])
        self.assertEqual(result["alreadyCollectedAmount"], 0)


if __name__ == "__main__":
    unittest.main()
