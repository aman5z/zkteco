#!/bin/bash
# ============================================================
#  ZKTeco Attendance Dashboard  v2.2  --  Launcher
#  Supports: Linux, macOS, Termux (Android)
#  Usage: bash attendance.sh
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ── Detect platform ───────────────────────────────────────────
detect_platform() {
    if [ -n "${TERMUX_VERSION:-}" ] || echo "${PREFIX:-}" | grep -q "com.termux" 2>/dev/null; then
        echo "termux"
    elif [ "$(uname -s 2>/dev/null)" = "Darwin" ]; then
        echo "macos"
    else
        echo "linux"
    fi
}
PLATFORM=$(detect_platform)

# Activate venv if present, else use system python3/python
if [ -f "venv/bin/activate" ]; then
    source venv/bin/activate
    PYTHON="python3"
elif command -v python3 &>/dev/null; then
    PYTHON="python3"
else
    PYTHON="python"
fi

# ── Find local IP ─────────────────────────────────────────────
get_ip() {
    case "$PLATFORM" in
        termux)
            ip addr show wlan0 2>/dev/null | grep 'inet ' | awk '{print $2}' | cut -d/ -f1 | head -1 \
                || ip addr show wlan1 2>/dev/null | grep 'inet ' | awk '{print $2}' | cut -d/ -f1 | head -1 \
                || echo "127.0.0.1"
            ;;
        macos)
            ipconfig getifaddr en0 2>/dev/null \
                || ipconfig getifaddr en1 2>/dev/null \
                || echo "127.0.0.1"
            ;;
        *)
            hostname -I 2>/dev/null | awk '{print $1}' || echo "127.0.0.1"
            ;;
    esac
}

# ── Open URL in browser ───────────────────────────────────────
open_browser() {
    local url="$1"
    case "$PLATFORM" in
        termux)
            termux-open-url "$url" 2>/dev/null || true
            ;;
        macos)
            open "$url" 2>/dev/null || true
            ;;
        *)
            xdg-open "$url" 2>/dev/null || true
            ;;
    esac
}

menu() {
    clear
    echo ""
    echo "  ============================================================"
    echo "   ZKTeco Attendance Dashboard  v2.2  [$PLATFORM]"
    echo "  ============================================================"
    echo ""
    echo "    [1]  Open Dashboard   (start server)"
    echo "    [2]  Sync Database    (full: employees + MDB + devices)"
    echo "    [3]  Sync Devices Only"
    echo "    [4]  Today's Absent Report  (Excel)"
    echo "    [5]  History Absent Report  (Excel, from MDB)"
    echo "    [6]  Export Employees from MDB"
    echo "    [7]  Scan MDB         (diagnostics)"
    echo "    [8]  Backup Database"
    echo "    [9]  Install/Update packages"
    if [ "$PLATFORM" = "linux" ]; then
        echo "    [S]  Install as systemd service (auto-start on boot)"
        echo "    [X]  Remove systemd service"
    elif [ "$PLATFORM" = "termux" ]; then
        echo "    [S]  Termux:Boot setup instructions"
    fi
    echo "    [0]  Exit"
    echo ""
    read -rp "  Choice: " CHOICE
    echo ""

    case "$CHOICE" in
        1) do_dashboard ;;
        2) do_sync_full ;;
        3) do_sync_devices ;;
        4) do_today ;;
        5) do_history ;;
        6) do_export ;;
        7) do_scan ;;
        8) do_backup ;;
        9) do_setup ;;
        [Ss]) do_service ;;
        [Xx]) [ "$PLATFORM" = "linux" ] && do_remove_service || echo "  Not supported on $PLATFORM." ; sleep 1 ; menu ;;
        0) echo "  Goodbye."; exit 0 ;;
        *) echo "  Invalid choice." ; sleep 1 ; menu ;;
    esac
}

after_action() {
    echo ""
    echo "  ────────────────────────────────────────"
    read -rp "  Press Enter to return to menu..." _
    menu
}

# ── Actions ───────────────────────────────────────────────────

do_dashboard() {
    echo "  Starting server..."
    echo "  URL : http://localhost:5000/d"
    echo "  Keep this window open. Ctrl+C to stop."
    echo "  ============================================================"
    # Open browser in background (best-effort)
    (sleep 3 && open_browser "http://localhost:5000/d") &
    $PYTHON server.py
    after_action
}

do_sync_full() {
    echo "  Full sync (employees + MDB history + devices)..."
    echo ""
    $PYTHON sync_db.py
    after_action
}

do_sync_devices() {
    echo "  Device-only sync..."
    echo ""
    $PYTHON sync_db.py devices-only
    after_action
}

do_today() {
    echo "  Today's Absent Report..."
    echo ""
    $PYTHON mdb_tools.py today
    after_action
}

do_history() {
    echo ""
    # Auto-detect MDB
    MDB_FILE=$(find "$SCRIPT_DIR" -maxdepth 1 \( -name "*.mdb" -o -name "*.accdb" \) 2>/dev/null | head -1)
    if [ -n "$MDB_FILE" ]; then
        echo "  MDB detected: $MDB_FILE"
    else
        read -rp "  Path to .mdb file: " MDB_FILE
    fi
    read -rp "  From (DD/MM/YYYY): " DATE_FROM
    read -rp "    To (DD/MM/YYYY): " DATE_TO
    echo ""
    $PYTHON mdb_tools.py history "$MDB_FILE" "$DATE_FROM" "$DATE_TO"
    after_action
}

do_export() {
    echo "  Exporting employees from MDB..."
    echo ""
    $PYTHON mdb_tools.py export
    after_action
}

do_scan() {
    echo ""
    MDB_FILE=$(find "$SCRIPT_DIR" -maxdepth 1 \( -name "*.mdb" -o -name "*.accdb" \) 2>/dev/null | head -1)
    if [ -n "$MDB_FILE" ]; then
        echo "  Scanning: $MDB_FILE"
        $PYTHON mdb_tools.py scan "$MDB_FILE"
    else
        read -rp "  Path to .mdb file: " MDB_PATH
        $PYTHON mdb_tools.py scan "$MDB_PATH"
    fi
    after_action
}

do_backup() {
    echo "  Backing up attendance.db..."
    $PYTHON sync_db.py backup
    after_action
}

do_setup() {
    echo "  Installing/updating packages..."
    echo ""
    case "$PLATFORM" in
        termux)
            pkg install -y python mdbtools 2>/dev/null || true
            pip install --upgrade flask pandas openpyxl pyzk werkzeug reportlab --quiet
            ;;
        macos)
            if command -v brew &>/dev/null; then
                brew install mdbtools 2>/dev/null || true
            fi
            pip3 install --upgrade flask pandas openpyxl pyzk werkzeug reportlab --quiet 2>/dev/null || \
                pip install --upgrade flask pandas openpyxl pyzk werkzeug reportlab --quiet
            ;;
        *)
            sudo apt-get install -y mdbtools --quiet
            pip install --upgrade flask pandas openpyxl pyzk werkzeug --quiet
            ;;
    esac
    echo "  OK: packages updated"
    after_action
}

do_service() {
    if [ "$PLATFORM" = "termux" ]; then
        echo "  ── Termux:Boot Auto-Start Setup ──────────────────────────"
        echo ""
        echo "  1. Install the 'Termux:Boot' app from F-Droid or Play Store."
        echo "  2. Open Termux:Boot once to grant permissions."
        echo "  3. Create the boot script:"
        echo ""
        echo "       mkdir -p ~/.termux/boot"
        echo "       cat > ~/.termux/boot/start-attendance.sh << 'EOF'"
        echo "       #!/data/data/com.termux/files/usr/bin/bash"
        echo "       cd $SCRIPT_DIR"
        echo "       $PYTHON server.py &"
        echo "       EOF"
        echo "       chmod +x ~/.termux/boot/start-attendance.sh"
        echo ""
        echo "  The dashboard will start automatically after each Android reboot."
        after_action
        return
    fi
    do_install_service
}

do_install_service() {
    echo "  Installing systemd service..."
    local SERVICE_FILE="/etc/systemd/system/attendance-dashboard.service"
    local VENV_PYTHON="$SCRIPT_DIR/venv/bin/python3"
    local RUN_PYTHON
    RUN_PYTHON=$([ -f "$VENV_PYTHON" ] && echo "$VENV_PYTHON" || echo "$(which python3)")

    sudo tee "$SERVICE_FILE" > /dev/null << EOF
[Unit]
Description=ZKTeco Attendance Dashboard
After=network.target

[Service]
Type=simple
User=$(whoami)
WorkingDirectory=$SCRIPT_DIR
ExecStart=$RUN_PYTHON $SCRIPT_DIR/server.py
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

    sudo systemctl daemon-reload
    sudo systemctl enable attendance-dashboard
    sudo systemctl restart attendance-dashboard

    echo ""
    echo "  Service installed and started!"
    echo "  Dashboard: http://$(get_ip):5000"
    echo ""
    echo "  Commands:"
    echo "    sudo systemctl status attendance-dashboard"
    echo "    sudo systemctl stop attendance-dashboard"
    echo "    sudo journalctl -u attendance-dashboard -f   (live logs)"
    after_action
}

do_remove_service() {
    echo "  Removing systemd service..."
    sudo systemctl stop attendance-dashboard 2>/dev/null || true
    sudo systemctl disable attendance-dashboard 2>/dev/null || true
    sudo rm -f /etc/systemd/system/attendance-dashboard.service
    sudo systemctl daemon-reload
    echo "  OK: service removed"
    after_action
}

# ── Entry point ───────────────────────────────────────────────
menu
