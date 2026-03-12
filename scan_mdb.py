"""
MDB Scanner — run this first to find the correct table/column names
Usage: python scan_mdb.py your_backup.mdb
"""
import sys
import pyodbc

mdb = sys.argv[1] if len(sys.argv) > 1 else None
if not mdb:
    import os
    # Try to find any .mdb in the same folder
    folder = os.path.dirname(os.path.abspath(__file__))
    for f in os.listdir(folder):
        if f.lower().endswith(".mdb") or f.lower().endswith(".accdb"):
            mdb = os.path.join(folder, f)
            break

if not mdb:
    print("[ERROR] No .mdb file found. Place your backup in the same folder or pass path as argument.")
    print("Usage: python scan_mdb.py path\\to\\backup.mdb")
    input("\nPress Enter to exit...")
    sys.exit(1)

print(f"\nScanning: {mdb}\n")

try:
    conn = pyodbc.connect(
        r"Driver={Microsoft Access Driver (*.mdb, *.accdb)};"
        f"Dbq={mdb};"
    )
except Exception as e:
    print(f"[ERROR] Cannot open: {e}")
    input("\nPress Enter to exit...")
    sys.exit(1)

cursor = conn.cursor()
tables = [r.table_name for r in cursor.tables(tableType="TABLE")]

print("=" * 60)
print(f"  Found {len(tables)} tables")
print("=" * 60)

for table in tables:
    try:
        cols = [r.column_name for r in cursor.columns(table=table)]
        # Try to get row count
        try:
            count = cursor.execute(f"SELECT COUNT(*) FROM [{table}]").fetchone()[0]
        except:
            count = "?"
        print(f"\n  TABLE: {table}  ({count} rows)")
        print(f"  {'─'*50}")
        for col in cols:
            print(f"    • {col}")
    except Exception as e:
        print(f"\n  TABLE: {table}  [Could not read: {e}]")

print("\n" + "=" * 60)
print("  Copy the correct table/column names into attendance_tool.py")
print("  Look for:")
print("    - A table with punch/check-in records (has timestamps)")
print("    - A table with employee names")
print("=" * 60)

input("\nPress Enter to exit...")
