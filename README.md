# 🏢 ERP Console

A unified, high-performance web dashboard merging a ZKTeco Biometric Attendance System with an IT Helpdesk and AD Console. Built entirely with Vanilla HTML, CSS, and JavaScript, it offers a deeply customizable, app-like experience with zero build-step overhead.

## ✨ Overview

The ERP Console serves as a centralized interface connecting to two primary backends:
1. **ZKTeco Local Server:** A Python/Flask API handling local biometric hardware, employee databases, and attendance logs.
2. **Google Apps Script (GAS):** A cloud backend managing IT Helpdesk tickets, token queues, drive storage, and secondary admin authentication.

It features full PWA (Progressive Web App) support, offline capabilities using IndexedDB, and a massive suite of built-in IT networking and utility tools.

<img width="1919" height="881" alt="Screenshot 2026-03-26 214654" src="https://github.com/user-attachments/assets/6c291473-75cd-4f0a-b634-afcc75cbdc84" />

## 🚀 Key Features

### 👥 Human Resources & Attendance
* **Live Dashboard:** Real-time stats for present/absent employees, offline tracking, and department attendance percentages.
* **Attendance Management:** View today's attendance, historical date-range reports, and individual employee calendars with shift and grace-period logic.
* **Remote Punching:** Allow employees to punch in/out from their devices. Includes offline support (saves to IndexedDB and syncs when back online).
* **Leave & Shift Admin:** Configure department-specific shifts, workdays, and system-wide holidays.

<img width="1667" height="713" alt="Screenshot 2026-03-26 214836" src="https://github.com/user-attachments/assets/a3e2ae7e-5724-43a8-b68b-9e6c7fc3c6b5" />


### 📡 Hardware Management (ZKTeco)
* **Device Fleet Control:** Monitor online/offline status for all connected ZKTeco terminals.
* **Remote Actions:** Ping devices, sync clocks, reboot, and view or download enrolled users and raw attendance logs directly from the dashboard.

<img width="1919" height="870" alt="Screenshot 2026-03-26 214927" src="https://github.com/user-attachments/assets/f0d928be-4d1b-4734-8e00-04b0df7f1097" />

### 🎫 IT Services & Collaboration
* **Helpdesk Ticketing:** Create, assign, and track IT support tickets with priority levels and due dates.
* **Token Queue:** Manage digital service counters (e.g., HR, Finance, Medical) with visual queue tracking.
* **Internal Chat & Notes:** Peer-to-peer messaging system and private, color-coded sticky notes.
* **Google Drive Integration:** Browse and upload files directly to a designated Google Drive folder.
* **Linode Terminal:** Integrated web shell connecting to your server via `ttyd` and an nginx proxy.

<img width="1919" height="877" alt="Screenshot 2026-03-26 214939" src="https://github.com/user-attachments/assets/33247b6e-dec4-4f83-9b63-8d9d577368ae" />
<img width="1919" height="878" alt="Screenshot 2026-03-26 214953" src="https://github.com/user-attachments/assets/5ee74551-b9e5-44d4-906d-88317393e6c4" />

### 🧰 Built-in IT Toolkit
A comprehensive suite of client-side utilities built right into the app:
* **Email Batch Manager:** Parse `.xlsx` files, extract, deduplicate, and batch emails for mass communication.
* **Generators:** QR codes, Code128 Barcodes, and secure Passwords.
* **PDF Tools:** Merge, split, compress, and watermark PDFs entirely in the browser using `pdf-lib`.
* **Networking:** IP/DNS Lookup, Subnet Calculator, MAC Vendor lookup, and live Ping Monitor charts.
* **Data Formatting:** Base64 encoding/decoding, Hex/Dec/Bin converters, and a Text Diff checker.

  <img width="1919" height="868" alt="Screenshot 2026-03-26 224502" src="https://github.com/user-attachments/assets/06b9f97f-e4b6-424f-9723-44fbeb9f35b8" />
<img width="1917" height="870" alt="Screenshot 2026-03-26 224444" src="https://github.com/user-attachments/assets/2cf96f77-d44d-49b8-b436-f5771df9ec70" />
<img width="1919" height="876" alt="Screenshot 2026-03-26 224419" src="https://github.com/user-attachments/assets/1badf3c7-753e-4fdd-91a5-4cfb99e131c8" />


## 🛠️ Tech Stack

* **Frontend:** HTML5, CSS3 (Native CSS Variables), Vanilla JavaScript (ES6+).
* **Offline Storage:** `localStorage` for settings, `IndexedDB` & Service Workers for offline punch caching.
* **External Libraries (via CDN):**
  * `JsBarcode` (Barcode generation)
  * `qrcode.js` (QR generation)
  * `pdf-lib` (Client-side PDF manipulation)
  * `SheetJS / xlsx` (Excel parsing and exporting)
  * `Chart.js` logic (Custom HTML5 Canvas charting for ping monitor)

<img width="1671" height="785" alt="Screenshot 2026-03-26 215032" src="https://github.com/user-attachments/assets/2e95a033-1456-4a70-ba1b-cba16c7ebd58" />


## 🎮 Demo Mode

Don't have the backends set up yet? You can explore the UI by clicking **"🎮 Enter Demo Mode"** on the login screen. This populates the app with mock employees, tickets, devices, and attendance data.

## 🔒 Security Note

This frontend relies on its connected backend services for true authorization. The built-in Role-Based Access Control (RBAC) hides UI elements based on the user's role, but your backend APIs (Flask/GAS) must validate session tokens independently for all sensitive read/write operations.




