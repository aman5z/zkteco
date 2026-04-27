import re
with open('server.py', 'r', encoding='utf-8') as f:
    lines = f.readlines()
for i, l in enumerate(lines):
    if '/api/auth/login' in l or 'def admin_delete_user' in l:
        print("MATCH AT LINE:", i, l.strip())
        print("".join(lines[i:i+30]))
