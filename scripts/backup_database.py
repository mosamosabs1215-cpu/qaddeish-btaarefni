#!/usr/bin/env python3
"""Consistent SQLite backup without copying the volatile -wal file by hand.

Usage: python scripts/backup_database.py --db /persistent/knowme.sqlite --out /private/backups
Keep the backup directory OUTSIDE the web-facing public/ directory. Schedule externally.
"""
import argparse, datetime, os, pathlib, sqlite3

def main():
    ap=argparse.ArgumentParser(description='Safe, verified SQLite backup for V7')
    ap.add_argument('--db',required=True,type=pathlib.Path)
    ap.add_argument('--out',required=True,type=pathlib.Path)
    args=ap.parse_args()
    if not args.db.is_file(): ap.error('Source SQLite file not found')
    args.out.mkdir(parents=True,exist_ok=True)
    if 'public' in args.out.resolve().parts:
        ap.error('Never store user database backups under public/')
    name=f"knowme-{datetime.datetime.now(datetime.timezone.utc):%Y%m%dT%H%M%SZ}-{os.getpid()}.sqlite"
    dst=args.out/name
    old_mask=os.umask(0o077)
    try:
        with sqlite3.connect(f'file:{args.db.resolve()}?mode=ro',uri=True) as source:
            with sqlite3.connect(dst) as target:source.backup(target,pages=128,sleep=.1)
        with sqlite3.connect(f'file:{dst.resolve()}?mode=ro',uri=True) as check:
            result=check.execute('PRAGMA integrity_check').fetchone()[0]
            if result!='ok':raise RuntimeError('Backup failed SQLite integrity_check: '+result)
        dst.chmod(0o600)
        print(f'Verified backup: {dst} ({dst.stat().st_size} bytes)')
    except BaseException:
        dst.unlink(missing_ok=True)
        raise
    finally:os.umask(old_mask)

if __name__=='__main__':main()
