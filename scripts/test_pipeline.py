"""Offline regressions: malformed upstream data must not become database writes."""
import sys
import unittest
import subprocess
import msvcrt
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'components' / 'scripte'))
import pandas as pd
from fetch_nba_schedule import schedule_rows
from update_nba_players import records


class PipelineDataTests(unittest.TestCase):
    def test_concurrent_runner_does_not_start_another_refresh(self):
        root = Path(__file__).resolve().parents[1]
        (root / 'logs').mkdir(exist_ok=True)
        with (root / 'logs' / 'pipeline.lock').open('a+b') as lock:
            lock.seek(0)
            if not lock.read(1):
                lock.write(b'0')
                lock.flush()
            lock.seek(0)
            msvcrt.locking(lock.fileno(), msvcrt.LK_NBLCK, 1)
            try:
                result = subprocess.run([sys.executable, str(root / 'components/scripte/run_daily_pipeline.py')],
                                        capture_output=True, text=True, timeout=20, cwd=root)
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertIn('already running', result.stdout)
            finally:
                lock.seek(0)
                msvcrt.locking(lock.fileno(), msvcrt.LK_UNLCK, 1)

    def fixture(self):
        return {'gameId': '0022600001', 'gameDate': '10/20/2026',
                'gameDateTimeUTC': '2026-10-21T02:00:00Z',
                'homeTeam_teamId': 1610612747, 'awayTeam_teamId': 0,
                'homeTeam_teamTricode': 'LAL', 'awayTeam_teamTricode': '',
                'gameStatusText': 'TBD'}

    def test_schedule_preserves_id_timezone_and_unknown_team(self):
        row = schedule_rows(pd.DataFrame([self.fixture()]))[0]
        self.assertEqual(row['nba_game_id'], '0022600001')
        self.assertEqual(row['startTime'], '2026-10-21T02:00:00+00:00')
        self.assertEqual(row['date'], '2026-10-20')
        self.assertIsNone(row['away_team_id'])
        self.assertEqual(row['awayTeam'], 'TBD')

    def test_invalid_schedule_rejected_before_writing(self):
        for frame in [pd.DataFrame(), pd.DataFrame([self.fixture()] * 2),
                      pd.DataFrame([{**self.fixture(), 'gameId': 'bad'}]),
                      pd.DataFrame([{**self.fixture(), 'gameDate': 'bad'}])]:
            with self.subTest(frame=frame.shape), self.assertRaises(ValueError):
                schedule_rows(frame)

    def test_player_ids_and_json_nulls(self):
        self.assertIsNone(records(pd.DataFrame([{'id': 1, 'PTS': float('nan')}]), 'id')[0]['PTS'])
        for frame in [pd.DataFrame(), pd.DataFrame([{'id': 1}, {'id': 1}]), pd.DataFrame([{'id': None}])]:
            with self.subTest(frame=frame.shape), self.assertRaises(ValueError):
                records(frame, 'id')


if __name__ == '__main__':
    unittest.main()
