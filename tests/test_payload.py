import sys, json, pathlib, unittest
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]/'server'))
from payload import valid_payload
class PayloadTests(unittest.TestCase):
    def test_shared_corpus(self):
        for case in json.loads(pathlib.Path(__file__).with_name('payload_cases.json').read_text()):
            with self.subTest(case=case['name']):
                self.assertEqual(valid_payload(case['payload']),case['valid'])
    def test_non_finite(self):
        for n in [float('nan'),float('inf'),-1]:
            self.assertFalse(valid_payload({'v':1,'p':{},'x':n}))
if __name__=='__main__': unittest.main()
