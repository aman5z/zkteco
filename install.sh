#!/bin/bash
# ============================================================
#  ZKTeco Attendance Dashboard  --  Ubuntu/Debian Installer
#  Run once: bash install.sh
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo ""
echo "  ============================================================"
echo "   ZKTeco Attendance Dashboard  --  Ubuntu Setup"
echo "  ============================================================"
echo ""

# ── System packages ──────────────────────────────────────────
echo "  [1/5] Installing system packages..."
sudo apt-get update -qq
sudo apt-get install -y python3 python3-pip python3-venv sqlite3 mdbtools
echo "  OK: system packages"

# ── Python packages ──────────────────────────────────────────
echo ""
echo "  [2/5] Installing Python packages..."
echo "  (using --break-system-packages --ignore-installed to avoid conflicts)"
pip install flask pandas openpyxl pyzk werkzeug reportlab \
    --break-system-packages \
    --ignore-installed \
    --quiet
echo "  OK: Python packages installed"

# ── Verify ───────────────────────────────────────────────────
echo ""
echo "  [3/5] Verifying installations..."
python3 -c "import flask"      && echo "    flask       OK" || echo "    flask       MISSING"
python3 -c "import pandas"     && echo "    pandas      OK" || echo "    pandas      MISSING"
python3 -c "import openpyxl"   && echo "    openpyxl    OK" || echo "    openpyxl    MISSING"
python3 -c "import zk"         && echo "    pyzk        OK" || echo "    pyzk        MISSING"
python3 -c "import werkzeug"   && echo "    werkzeug    OK" || echo "    werkzeug    MISSING"
python3 -c "import reportlab"  && echo "    reportlab   OK" || echo "    reportlab   MISSING"
command -v mdb-export &>/dev/null && echo "    mdbtools    OK" || echo "    mdbtools    MISSING"
command -v sqlite3    &>/dev/null && echo "    sqlite3     OK" || echo "    sqlite3     MISSING"

# ── Employee export (if MDB present) ─────────────────────────
echo ""
echo "  [4/5] Checking for MDB database..."
MDB_FILE=$(find "$SCRIPT_DIR" -maxdepth 1 \( -name "*.mdb" -o -name "*.accdb" \) 2>/dev/null | head -1)
if [ -n "$MDB_FILE" ]; then
    echo "  Found: $MDB_FILE"
    echo "  Exporting employees..."
    python3 mdb_tools.py export && echo "  OK: employees exported" || echo "  WARN: export failed"
else
    echo "  No MDB found — skipping export"
    echo "  Place your .mdb file here and run: python3 mdb_tools.py export"
fi

# ── Device sync ───────────────────────────────────────────────
echo ""
echo "  [5/5] Syncing from devices (devices-only — skips MDB import)..."
python3 sync_db.py devices-only || echo "  WARN: device sync failed (check network/devices are reachable)"

# ── Done ─────────────────────────────────────────────────────
echo ""
echo "  ============================================================"
echo "   Setup complete!"
echo ""
echo "   To start the dashboard:"
echo "     bash attendance.sh         (interactive menu)"
echo "     python3 server.py          (direct start)"
echo ""
echo "   To auto-start on boot:"
echo "     bash attendance.sh  →  option [S]"
echo ""
echo "   Access at: http://$(hostname -I | awk '{print $1}'):5000"
echo "  ============================================================"
echo ""
