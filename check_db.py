import sqlite3, json

conn = sqlite3.connect('attendance.db')
conn.row_factory = sqlite3.Row

print("=== ALL SETTINGS ===")
rows = conn.execute("SELECT key, value FROM settings ORDER BY key").fetchall()
for r in rows:
    print(f"  {r['key']!r:40s} = {r['value']!r}")

print("\n=== USERS FILE ===")
try:
    import os
    with open('dashboard_users.json') as f:
        users = json.load(f)
    for u, v in users.items():
        print(f"  {u}: role={v.get('role')}, name={v.get('name')}, avatar_id={v.get('avatar_id','<none>')}")
except Exception as e:
    print(f"  Error: {e}")

print("\n=== SECRET KEY FILE ===")
if os.path.exists('.flask_secret'):
    with open('.flask_secret') as f:
        sk = f.read().strip()
    print(f"  Flask secret key: {sk[:16]}... ({len(sk)} chars)")
else:
    print("  .flask_secret does NOT exist!")

conn.close()
