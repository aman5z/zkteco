"""
ZKTeco Attendance Dashboard — Flask Backend
Run: python server.py
Then open: http://localhost:5000
"""

import os, sys, warnings, json, threading
from datetime import datetime, date
from concurrent.futures import ThreadPoolExecutor, as_completed
import warnings
warnings.filterwarnings("ignore")

from flask import Flask, jsonify, request, send_from_directory
import pandas as pd

# ── CONFIG ────────────────────────────────────────────────────────────────────
DEVICE_IPS   = ["10.20.141.21","10.20.141.22","10.20.141.23","10.20.141.24"]
DEVICE_PORT  = 4370
DEVICE_TIMEOUT = 8

SCRIPT_DIR   = os.path.dirname(os.path.abspath(__file__))
MDB_PATH     = os.path.join(SCRIPT_DIR, "your_backup.mdb")

INCLUDE_DEPARTMENTS = ["admin", "teaching", "support", "cleaning staff", "transport"]

CHECKINOUT_TABLE = "CHECKINOUT"
USERINFO_TABLE   = "USERINFO"
DEPT_TABLE       = "DEPARTMENTS"
COL_USER_ID      = "USERID"
COL_CHECKTIME    = "CHECKTIME"
COL_EMP_NAME     = "Name"
COL_BADGE        = "Badgenumber"
COL_DEPT_ID      = "DEFAULTDEPTID"
COL_ATT_FLAG     = "ATT"
COL_DEPT_NAME    = "DEPTNAME"
COL_DEPT_ID_PK   = "DEPTID"
# ─────────────────────────────────────────────────────────────────────────────

app = Flask(__name__, static_folder=SCRIPT_DIR)


def connect_mdb():
    import pyodbc
    return pyodbc.connect(
        r"Driver={Microsoft Access Driver (*.mdb, *.accdb)};"
        f"Dbq={MDB_PATH};"
    )


def load_employees(conn):
    emp_df  = pd.read_sql(f"SELECT [{COL_USER_ID}],[{COL_EMP_NAME}],[{COL_BADGE}],[{COL_DEPT_ID}],[{COL_ATT_FLAG}] FROM [{USERINFO_TABLE}]", conn)
    dept_df = pd.read_sql(f"SELECT [{COL_DEPT_ID_PK}],[{COL_DEPT_NAME}] FROM [{DEPT_TABLE}]", conn)
    emp_df  = emp_df[emp_df[COL_ATT_FLAG] == 1].copy()
    for c in [COL_USER_ID, COL_BADGE, COL_DEPT_ID]:
        emp_df[c] = emp_df[c].astype(str).str.strip()
    dept_df[COL_DEPT_ID_PK] = dept_df[COL_DEPT_ID_PK].astype(str).str.strip()
    emp_df = emp_df.merge(dept_df, left_on=COL_DEPT_ID, right_on=COL_DEPT_ID_PK, how="left")
    emp_df[COL_DEPT_NAME] = emp_df[COL_DEPT_NAME].fillna("Unknown")
    emp_df = emp_df[emp_df[COL_DEPT_NAME].str.strip().str.lower().isin([d.lower() for d in INCLUDE_DEPARTMENTS])].copy()
    return emp_df


def connect_device(ip):
    from zk import ZK
    zk = ZK(ip, port=DEVICE_PORT, timeout=DEVICE_TIMEOUT, verbose=False)
    return zk.connect()


# ── ROUTES ────────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    return send_from_directory(SCRIPT_DIR, "dashboard.html")


def _check_device_status(ip):
    conn = None
    try:
        from zk import ZK
        zk   = ZK(ip, port=DEVICE_PORT, timeout=4, verbose=False)
        conn = zk.connect()
        info = {
            "ip":         ip,
            "online":     True,
            "serialno":   conn.get_serialnumber() if hasattr(conn, 'get_serialnumber') else 'N/A',
            "platform":   conn.get_platform() if hasattr(conn, 'get_platform') else 'N/A',
            "user_count": len(conn.get_users()),
        }
    except Exception as e:
        info = {"ip": ip, "online": False, "error": str(e)}
    finally:
        if conn:
            try: conn.disconnect()
            except: pass
    return info


@app.route("/api/devices/status")
def devices_status():
    with ThreadPoolExecutor(max_workers=4) as ex:
        futures = {ex.submit(_check_device_status, ip): ip for ip in DEVICE_IPS}
        results = {}
        for f in as_completed(futures):
            r = f.result()
            results[r["ip"]] = r
    return jsonify([results[ip] for ip in DEVICE_IPS])


@app.route("/api/device/<ip>/users")
def device_users(ip):
    if ip not in DEVICE_IPS:
        return jsonify({"error": "Unknown device"}), 400
    conn = None
    try:
        conn  = connect_device(ip)
        users = conn.get_users()
        data  = [{"uid": u.user_id, "name": u.name, "privilege": u.privilege} for u in users]
        return jsonify({"ip": ip, "count": len(data), "users": data})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if conn:
            try: conn.disconnect()
            except: pass


@app.route("/api/today")
def today_report():
    today = date.today()
    try:
        db_conn = connect_mdb()
        emp_df  = load_employees(db_conn)
        db_conn.close()
    except Exception as e:
        return jsonify({"error": f"Database error: {e}"}), 500

    def _pull_today(ip):
        zk_conn = None
        try:
            from zk import ZK
            zk      = ZK(ip, port=DEVICE_PORT, timeout=DEVICE_TIMEOUT, verbose=False)
            zk_conn = zk.connect()
            zk_conn.disable_device()
            records   = zk_conn.get_attendance()
            today_ids = set()
            day_hits  = 0
            for r in records:
                if r.timestamp.date() == today:
                    today_ids.add(str(r.user_id).strip())
                    day_hits += 1
            zk_conn.enable_device()
            return {"ip": ip, "online": True, "punches_today": day_hits, "ids": today_ids}
        except Exception as e:
            return {"ip": ip, "online": False, "error": str(e), "ids": set()}
        finally:
            if zk_conn:
                try: zk_conn.disconnect()
                except: pass

    present_ids   = set()
    device_status = []

    with ThreadPoolExecutor(max_workers=4) as ex:
        futures = {ex.submit(_pull_today, ip): ip for ip in DEVICE_IPS}
        dev_results = {}
        for f in as_completed(futures):
            r = f.result()
            dev_results[r["ip"]] = r

    for ip in DEVICE_IPS:
        r = dev_results[ip]
        present_ids.update(r.get("ids", set()))
        device_status.append({k: v for k, v in r.items() if k != "ids"})

    absent, present = [], []
    for _, emp in emp_df.iterrows():
        uid  = emp[COL_USER_ID]
        rec  = {"name": emp[COL_EMP_NAME], "code": emp[COL_BADGE], "dept": emp[COL_DEPT_NAME]}
        if uid in present_ids:
            present.append(rec)
        else:
            absent.append(rec)

    absent.sort(key=lambda x: (x["dept"], x["name"]))
    present.sort(key=lambda x: (x["dept"], x["name"]))

    return jsonify({
        "date":          today.strftime("%d %B %Y"),
        "total":         len(emp_df),
        "present_count": len(present),
        "absent_count":  len(absent),
        "present":       present,
        "absent":        absent,
        "devices":       device_status,
    })


@app.route("/api/history")
def history_report():
    from_str = request.args.get("from")
    to_str   = request.args.get("to")
    if not from_str or not to_str:
        return jsonify({"error": "Provide ?from=DD/MM/YYYY&to=DD/MM/YYYY"}), 400
    try:
        date_from = datetime.strptime(from_str, "%d/%m/%Y").date()
        date_to   = datetime.strptime(to_str,   "%d/%m/%Y").date()
    except:
        return jsonify({"error": "Invalid date format. Use DD/MM/YYYY"}), 400

    try:
        conn    = connect_mdb()
        emp_df  = load_employees(conn)
        fs, ts  = date_from.strftime("%Y-%m-%d"), date_to.strftime("%Y-%m-%d")
        punch_df = pd.read_sql(
            f"SELECT [{COL_USER_ID}],[{COL_CHECKTIME}] FROM [{CHECKINOUT_TABLE}] "
            f"WHERE [{COL_CHECKTIME}] >= #{fs}# AND [{COL_CHECKTIME}] <= #{ts} 23:59:59#",
            conn
        )
        conn.close()
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    punch_df[COL_CHECKTIME] = pd.to_datetime(punch_df[COL_CHECKTIME], errors="coerce")
    punch_df = punch_df.dropna(subset=[COL_CHECKTIME])
    punch_df["_date"] = punch_df[COL_CHECKTIME].dt.date
    punch_df["_uid"]  = punch_df[COL_USER_ID].astype(str).str.strip()

    all_dates = pd.date_range(date_from, date_to).date
    days_data = []
    for d in all_dates:
        present_ids = set(punch_df[punch_df["_date"] == d]["_uid"].unique())
        absent, present = [], []
        for _, emp in emp_df.iterrows():
            uid = emp[COL_USER_ID]
            rec = {"name": emp[COL_EMP_NAME], "code": emp[COL_BADGE], "dept": emp[COL_DEPT_NAME]}
            if uid in present_ids:
                present.append(rec)
            else:
                absent.append(rec)
        absent.sort(key=lambda x: (x["dept"], x["name"]))
        present.sort(key=lambda x: (x["dept"], x["name"]))
        days_data.append({
            "date":          d.strftime("%d %b %Y"),
            "date_iso":      d.strftime("%Y-%m-%d"),
            "present_count": len(present),
            "absent_count":  len(absent),
            "present":       present,
            "absent":        absent,
        })

    return jsonify({
        "from":       date_from.strftime("%d %b %Y"),
        "to":         date_to.strftime("%d %b %Y"),
        "total_emps": len(emp_df),
        "days":       days_data,
    })


@app.route("/api/device/<ip>/attendance")
def device_attendance(ip):
    """Attendance log for a specific device, filtered by date."""
    if ip not in DEVICE_IPS:
        return jsonify({"error": "Unknown device"}), 400
    date_str = request.args.get("date", date.today().strftime("%Y-%m-%d"))
    try:
        filter_date = datetime.strptime(date_str, "%Y-%m-%d").date()
    except:
        return jsonify({"error": "Use ?date=YYYY-MM-DD"}), 400

    conn = None
    try:
        conn    = connect_device(ip)
        records = conn.get_attendance()
        data    = []
        for r in records:
            if r.timestamp.date() == filter_date:
                data.append({
                    "uid":  str(r.user_id),
                    "time": r.timestamp.strftime("%H:%M:%S"),
                    "type": str(r.punch),
                })
        data.sort(key=lambda x: x["time"])
        return jsonify({"ip": ip, "date": date_str, "count": len(data), "records": data})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if conn:
            try: conn.disconnect()
            except: pass


if __name__ == "__main__":
    print("\n" + "═"*50)
    print("  ZKTeco Attendance Dashboard")
    print("  Open browser → http://localhost:5000")
    print("═"*50 + "\n")
    app.run(host="0.0.0.0", port=5000, debug=False)


# ── EXPORT ENDPOINTS ──────────────────────────────────────────────────────────
import io
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from flask import send_file

def _thin():
    s = Side(style="thin", color="CCCCCC")
    return Border(left=s,right=s,top=s,bottom=s)

def _build_absent_wb(absent_list, title):
    wb = Workbook(); ws = wb.active; ws.title = "Absent"
    ws.sheet_view.showGridLines = False
    ws.merge_cells("A1:D1")
    c = ws.cell(row=1,column=1,value=title)
    c.font = Font(name="Arial",bold=True,size=13,color="1F4E79")
    c.alignment = Alignment(horizontal="center",vertical="center")
    ws.row_dimensions[1].height = 28
    for col,hdr in enumerate(["Name","Emp Code","Department","Date"],1):
        c = ws.cell(row=3,column=col,value=hdr)
        c.font = Font(name="Arial",bold=True,color="FFFFFF",size=10)
        c.fill = PatternFill("solid",start_color="1F4E79")
        c.alignment = Alignment(horizontal="center",vertical="center")
        c.border = _thin()
    row = 4; prev_dept = None
    for i, rec in enumerate(sorted(absent_list, key=lambda x:(x["dept"],x["name"]))):
        if rec["dept"] != prev_dept:
            for col in range(1,5):
                c = ws.cell(row=row,column=col,value=rec["dept"] if col==1 else "")
                c.fill = PatternFill("solid",start_color="DCE6F1")
                c.font = Font(name="Arial",bold=True,size=10,color="1F4E79")
                c.border = _thin()
            row += 1; prev_dept = rec["dept"]
        bg = "EBF3FB" if i%2==0 else "FFFFFF"
        for col,val in enumerate([rec["name"],rec["code"],rec["dept"],rec.get("date","")],1):
            c = ws.cell(row=row,column=col,value=val)
            c.font = Font(name="Arial",size=10)
            c.fill = PatternFill("solid",start_color=bg)
            c.border = _thin()
            c.alignment = Alignment(horizontal="center" if col in (2,4) else "left",vertical="center")
        row += 1
    for col,w in zip("ABCD",[30,12,24,14]):
        ws.column_dimensions[col].width = w
    return wb


@app.route("/api/today/export")
def export_today():
    today = date.today()
    try:
        conn   = connect_mdb()
        emp_df = load_employees(conn)
        conn.close()
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    def _pull_export(ip):
        zk_conn = None
        try:
            from zk import ZK
            zk = ZK(ip,port=DEVICE_PORT,timeout=DEVICE_TIMEOUT,verbose=False)
            zk_conn = zk.connect(); zk_conn.disable_device()
            ids = {str(r.user_id).strip() for r in zk_conn.get_attendance() if r.timestamp.date() == today}
            zk_conn.enable_device()
            return ids
        except: return set()
        finally:
            if zk_conn:
                try: zk_conn.disconnect()
                except: pass

    present_ids = set()
    with ThreadPoolExecutor(max_workers=4) as ex:
        for ids in ex.map(_pull_export, DEVICE_IPS):
            present_ids.update(ids)

    absent = []
    for _, emp in emp_df.iterrows():
        if emp[COL_USER_ID] not in present_ids:
            absent.append({"name":emp[COL_EMP_NAME],"code":emp[COL_BADGE],"dept":emp[COL_DEPT_NAME],"date":today.strftime("%d/%m/%Y")})

    wb  = _build_absent_wb(absent, f"Absent Report — {today.strftime('%d %B %Y')}")
    buf = io.BytesIO(); wb.save(buf); buf.seek(0)
    return send_file(buf, download_name=f"absent_{today.strftime('%Y%m%d')}.xlsx",
                     as_attachment=True, mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")


@app.route("/api/history/export")
def export_history():
    from_str = request.args.get("from"); to_str = request.args.get("to")
    try:
        date_from = datetime.strptime(from_str,"%d/%m/%Y").date()
        date_to   = datetime.strptime(to_str,  "%d/%m/%Y").date()
    except:
        return jsonify({"error":"Invalid dates"}), 400

    conn    = connect_mdb()
    emp_df  = load_employees(conn)
    fs, ts  = date_from.strftime("%Y-%m-%d"), date_to.strftime("%Y-%m-%d")
    punch_df = pd.read_sql(
        f"SELECT [{COL_USER_ID}],[{COL_CHECKTIME}] FROM [{CHECKINOUT_TABLE}] "
        f"WHERE [{COL_CHECKTIME}] >= #{fs}# AND [{COL_CHECKTIME}] <= #{ts} 23:59:59#", conn)
    conn.close()
    punch_df[COL_CHECKTIME] = pd.to_datetime(punch_df[COL_CHECKTIME],errors="coerce")
    punch_df = punch_df.dropna(subset=[COL_CHECKTIME])
    punch_df["_date"] = punch_df[COL_CHECKTIME].dt.date
    punch_df["_uid"]  = punch_df[COL_USER_ID].astype(str).str.strip()

    all_absent = []
    for d in pd.date_range(date_from, date_to).date:
        present = set(punch_df[punch_df["_date"]==d]["_uid"].unique())
        for _, emp in emp_df.iterrows():
            if emp[COL_USER_ID] not in present:
                all_absent.append({"name":emp[COL_EMP_NAME],"code":emp[COL_BADGE],"dept":emp[COL_DEPT_NAME],"date":d.strftime("%d/%m/%Y")})

    wb  = _build_absent_wb(all_absent, f"Absent History — {date_from.strftime('%d %b')} to {date_to.strftime('%d %b %Y')}")
    buf = io.BytesIO(); wb.save(buf); buf.seek(0)
    fname = f"absent_{date_from.strftime('%Y%m%d')}_{date_to.strftime('%Y%m%d')}.xlsx"
    return send_file(buf, download_name=fname, as_attachment=True,
                     mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
