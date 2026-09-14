import unittest
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from build_excel_demo_data_stream import Stats, month_values

class MissingDataTest(unittest.TestCase):
    def test_empty_month_is_unknown(self):
        for key in ('safety','fuel','speed','idle','load','dtc'):
            self.assertIsNone(month_values([Stats()],key)[0])
    def test_observed_zero_is_zero(self):
        self.assertEqual(month_values([Stats(rows=10)],'speed'), [0])
        self.assertEqual(month_values([Stats(rows=10)],'safety'), [100])

if __name__ == '__main__':
    unittest.main()
