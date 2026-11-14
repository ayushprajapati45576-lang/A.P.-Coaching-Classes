import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import styles from './FeeReceiptModal.module.css';
import { Printer, X, Share2, MessageCircle, Copy, Check, Download, Loader2 } from 'lucide-react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

// Number to Words in Indian format (e.g. 5000 -> Five Thousand Rupees Only)
const numberToWordsIndian = (num) => {
    const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 
               'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    const inWords = (n) => {
        if (n === 0) return '';
        if (n < 20) return a[n] + ' ';
        if (n < 100) return b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + a[n % 10] : '') + ' ';
        if (n < 1000) return a[Math.floor(n / 100)] + ' Hundred ' + inWords(n % 100);
        if (n < 100000) return inWords(Math.floor(n / 1000)) + 'Thousand ' + inWords(n % 1000);
        if (n < 10000000) return inWords(Math.floor(n / 100000)) + 'Lakh ' + inWords(n % 100000);
        return inWords(Math.floor(n / 10000000)) + 'Crore ' + inWords(n % 10000000);
    };

    const n = Math.floor(Number(num) || 0);
    if (n === 0) return 'Zero Rupees Only';
    return inWords(n).trim() + ' Rupees Only';
};

const formatCurrency = (val) => {
    const num = Number(val) || 0;
    return '₹' + num.toLocaleString('en-IN');
};

const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return String(dateStr);
        return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
        return String(dateStr);
    }
};

// Clean text generator for WhatsApp & Direct Sharing
const generateReceiptShareText = (receipt) => {
    const studentName = receipt.studentName || 'Student';
    const fatherName = receipt.fatherName && receipt.fatherName !== '-' ? `\n👨‍👦 *Father's Name:* ${receipt.fatherName}` : '';
    const rawClass = receipt.className || receipt.class || '';
    const classStr = rawClass ? (String(rawClass).toLowerCase().includes('class') ? rawClass : `Class ${rawClass}`) : '';
    const receiptNo = receipt.receiptNo || (receipt.id ? `REC-${String(receipt.id).padStart(5, '0')}` : `APC-${Date.now().toString().slice(-6)}`);
    const dateStr = formatDate(receipt.date || new Date().toISOString());
    const totalFees = Number(receipt.totalFees || 0);
    const currentPaid = Number(receipt.currentPaid || receipt.amount || receipt.paidFees || 0);
    const previouslyPaid = Math.max(0, (Number(receipt.totalPaid || currentPaid)) - currentPaid);
    const remainingFees = Number(receipt.remainingFees !== undefined ? receipt.remainingFees : Math.max(0, totalFees - previouslyPaid - currentPaid));
    const dueDateStr = receipt.dueDate ? formatDate(receipt.dueDate) : '';
    const paymentMode = receipt.paymentMode || 'Cash / Online UPI';
    const isStatement = Boolean(receipt.isStatement);
    const isMonthly = receipt.fee_type === 'Monthly';

    if (isMonthly) {
        return `🧾 *A.P. COACHING CLASSES*
*${isStatement ? 'MONTHLY FEES STATEMENT / विवरण' : 'MONTHLY FEE RECEIPT / मासिक फीस रसीद'}*
━━━━━━━━━━━━━━━━━━━━
👤 *Student:* ${studentName}${fatherName}
🏫 *Class:* ${classStr || 'General'}
🔢 *Receipt No:* ${receiptNo}
📅 *Date:* ${dateStr}

💰 *Payment Details:*
• Fee Plan: Monthly (मासिक)
• *Amount Received: ₹${currentPaid.toLocaleString('en-IN')} (PAID ✓)*${receipt.month_for ? `\n• Month: ${receipt.month_for}` : ''}${dueDateStr ? `\n• Next Due Date: ${dueDateStr}` : ''}
• Payment Mode: ${paymentMode}

✅ *Status:* Official monthly payment recorded & verified in coaching system.
━━━━━━━━━━━━━━━━━━━━
📍 *A.P. Coaching Classes | Anil Sir Campus*
📞 *Director Helpline:* +91 9981182741
✨ *Concept Clear, Future Secure*`;
    }

    return `🧾 *A.P. COACHING CLASSES*
*${isStatement ? 'FEES STATEMENT / विवरण' : 'OFFICIAL FEE RECEIPT / फीस रसीद'}*
━━━━━━━━━━━━━━━━━━━━
👤 *Student:* ${studentName}${fatherName}
🏫 *Class:* ${classStr || 'General'}
🔢 *Receipt No:* ${receiptNo}
📅 *Date:* ${dateStr}

💰 *Payment Details:*
• Total Course Fees: ₹${totalFees.toLocaleString('en-IN')}${previouslyPaid > 0 ? `\n• Previously Paid: ₹${previouslyPaid.toLocaleString('en-IN')}` : ''}
• *Amount Received: ₹${currentPaid.toLocaleString('en-IN')} (PAID ✓)*
• *Remaining Due: ₹${remainingFees.toLocaleString('en-IN')}*${remainingFees > 0 && dueDateStr ? `\n• Next Due Date: ${dueDateStr}` : ''}
• Payment Mode: ${paymentMode}

✅ *Status:* Official payment recorded & verified in coaching system.
━━━━━━━━━━━━━━━━━━━━
📍 *A.P. Coaching Classes | Anil Sir Campus*
📞 *Director Helpline:* +91 9981182741
✨ *Concept Clear, Future Secure*`;
};

// Base64 logo helper to guarantee zero-latency, zero-CORS rendering
let cachedLogoDataUrl = null;
const getLogoDataUrl = async () => {
    if (cachedLogoDataUrl) return cachedLogoDataUrl;
    try {
        const response = await fetch('/logo.jpeg');
        const blob = await response.blob();
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                cachedLogoDataUrl = reader.result;
                resolve(reader.result);
            };
            reader.onerror = () => resolve(window.location.origin + '/logo.jpeg');
            reader.readAsDataURL(blob);
        });
    } catch {
        return window.location.origin + '/logo.jpeg';
    }
};

// CSS styles specifically designed for standard A4 desktop proportion (794px width)
// immune to mobile viewport clamping
const getReceiptCss = () => `
    @page {
        size: A4 portrait;
        margin: 8mm 10mm;
    }
    * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        color-adjust: exact !important;
    }
    html, body {
        width: 794px;
        margin: 0;
        padding: 0;
        background: #ffffff;
        font-family: 'Segoe UI', system-ui, -apple-system, Roboto, Arial, sans-serif;
        color: #1e293b;
    }
    .receipt-card {
        box-sizing: border-box !important;
        width: 794px !important;
        min-width: 794px !important;
        max-width: 794px !important;
        min-height: 1060px;
        border: 2.5px solid #1B2240;
        border-radius: 10px;
        padding: 24px 28px 20px 28px;
        position: relative;
        background: #ffffff !important;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        font-family: 'Segoe UI', system-ui, -apple-system, Roboto, Arial, sans-serif;
    }
    .receipt-card::before {
        content: '';
        position: absolute;
        top: 6px;
        left: 6px;
        right: 6px;
        bottom: 6px;
        border: 1px solid rgba(27, 34, 64, 0.22);
        border-radius: 7px;
        pointer-events: none;
    }
    .header {
        display: flex !important;
        flex-direction: row !important;
        flex-wrap: nowrap !important;
        justify-content: space-between;
        align-items: center;
        border-bottom: 2px solid #1B2240;
        padding-bottom: 12px;
        gap: 12px;
        width: 100%;
    }
    .logo-title {
        display: flex !important;
        flex-direction: row !important;
        align-items: center;
        gap: 14px;
    }
    .logo {
        width: 68px !important;
        height: 68px !important;
        min-width: 68px !important;
        min-height: 68px !important;
        border-radius: 50%;
        border: 2.5px solid #E08A00;
        object-fit: cover;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
    }
    .title h1 {
        font-size: 22px;
        font-weight: 800;
        color: #1B2240;
        margin: 0;
        letter-spacing: 0.5px;
        line-height: 1.2;
    }
    .title p.tagline {
        font-size: 11.5px;
        font-weight: 700;
        color: #E08A00;
        margin: 2px 0 0 0;
    }
    .title p.sub {
        font-size: 11px;
        color: #475569;
        font-weight: 500;
        margin: 2px 0 0 0;
    }
    .title p.contact {
        font-size: 11.5px;
        color: #1B2240;
        font-weight: 700;
        margin: 2px 0 0 0;
    }
    .badge-box {
        text-align: right;
        flex-shrink: 0;
        min-width: 170px;
    }
    .badge {
        background: #1B2240 !important;
        color: #ffffff !important;
        font-size: 12px;
        font-weight: 700;
        padding: 5px 14px;
        border-radius: 6px;
        display: inline-block;
        letter-spacing: 0.5px;
    }
    .receipt-no {
        font-size: 11.5px;
        color: #64748b;
        margin-top: 4px;
        font-weight: 700;
    }
    .receipt-date {
        font-size: 11px;
        color: #0f172a;
        font-weight: 600;
        margin-top: 2px;
    }
    .content-body {
        display: flex;
        flex-direction: column;
        gap: 12px;
        flex: 1;
        justify-content: space-around;
        padding: 10px 0;
    }
    .info-table {
        width: 100% !important;
        border-collapse: collapse;
        background: #f8fafc !important;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        table-layout: fixed;
    }
    .info-table td {
        width: 50%;
        padding: 6px 12px;
        font-size: 13.5px;
        line-height: 1.35;
        vertical-align: top;
    }
    .info-label {
        color: #64748b;
        display: inline-block;
        width: 125px;
        font-weight: 600;
    }
    .info-val {
        color: #0f172a;
        font-weight: 700;
    }
    .fee-table {
        width: 100% !important;
        border-collapse: collapse;
        table-layout: fixed;
    }
    .fee-table th {
        background: #1B2240 !important;
        color: #ffffff !important;
        font-size: 13px;
        font-weight: 700;
        padding: 9px 12px;
        text-align: left;
    }
    .fee-table th.col-amount, .fee-table td.col-amount {
        width: 160px;
        text-align: right;
    }
    .fee-table th.col-sno, .fee-table td.col-sno {
        width: 45px;
        text-align: center;
    }
    .fee-table td {
        padding: 10px 12px;
        border-bottom: 1px solid #e2e8f0;
        font-size: 13.5px;
        color: #1e293b;
    }
    .paid-row {
        background: #ecfdf5 !important;
    }
    .paid-row td {
        color: #065f46 !important;
        font-weight: 800;
        font-size: 14.5px;
    }
    .paid-tag {
        background: #10b981 !important;
        color: #ffffff !important;
        font-size: 11px;
        font-weight: 800;
        padding: 2px 9px;
        border-radius: 99px;
        margin-left: 8px;
        vertical-align: middle;
    }
    .due-row td {
        color: #b91c1c !important;
        font-weight: 700;
    }
    .meta-box {
        background: #f8fafc !important;
        border: 1px dashed #cbd5e1;
        border-radius: 8px;
        padding: 9px 14px;
        font-size: 13px;
        line-height: 1.5;
        display: flex;
        flex-direction: column;
        gap: 3px;
    }
    .terms-box {
        background: #fcfcfd !important;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 8px 14px;
        font-size: 11px;
        color: #475569;
        line-height: 1.45;
    }
    .terms-title {
        font-weight: 700;
        color: #1B2240;
        margin-bottom: 3px;
        font-size: 11.5px;
    }
    .bottom-row {
        display: flex !important;
        flex-direction: row !important;
        flex-wrap: nowrap !important;
        justify-content: space-between;
        align-items: flex-end;
        padding-top: 6px;
        width: 100%;
    }
    .stamp-box {
        width: 140px;
        border: 2px dashed #059669;
        border-radius: 8px;
        color: #059669;
        text-align: center;
        padding: 6px;
        transform: rotate(-3deg);
        line-height: 1.3;
    }
    .sign-box {
        text-align: center;
        width: 190px;
    }
    .sign-text {
        font-family: 'Brush Script MT', 'Dancing Script', 'Segoe Script', cursive, sans-serif;
        font-size: 24px;
        color: #1B2240;
        font-weight: bold;
    }
    .sign-line {
        border-top: 1.5px solid #1B2240;
        margin: 3px 0 4px 0;
    }
    .sign-title {
        font-size: 11px;
        font-weight: 700;
        color: #334155;
    }
    .footer-note {
        border-top: 1px solid #e2e8f0;
        padding-top: 6px;
        font-size: 10.5px;
        color: #94a3b8;
        text-align: center;
    }
    @media print {
        body { width: 100% !important; height: 100% !important; }
        .receipt-card { width: 100% !important; min-height: 270mm !important; }
    }
`;

// Inner receipt card HTML with non-collapsible 2-column table layout
const buildReceiptCardHtml = (receipt, logoUrl) => {
    const previouslyPaid = Math.max(0, (receipt.totalPaid || receipt.currentPaid) - receipt.currentPaid);
    const receiptNo = receipt.receiptNo || (receipt.id ? `REC-${String(receipt.id).padStart(5, '0')}` : `APC-${Date.now().toString().slice(-6)}`);
    const dateStr = formatDate(receipt.date || new Date().toISOString());
    const studentName = receipt.studentName || receipt.student_name || 'Student';
    const fatherName = receipt.fatherName || '-';
    const rawClass = receipt.className || receipt.class || '';
    const classNameStr = rawClass ? (String(rawClass).toLowerCase().includes('class') ? rawClass : `Class ${rawClass}`) : '-';
    const phone = receipt.phone || '-';
    const studentEmail = receipt.email || receipt.studentEmail || '';
    const totalFeesStr = formatCurrency(receipt.totalFees);
    const currentPaidStr = formatCurrency(receipt.currentPaid);
    const prevPaidStr = formatCurrency(previouslyPaid);
    const remainingStr = formatCurrency(receipt.remainingFees);
    const inWordsStr = numberToWordsIndian(receipt.currentPaid);
    const dueDateStr = receipt.dueDate ? formatDate(receipt.dueDate) : '-';
    const paymentMode = receipt.paymentMode || 'Cash / Online UPI';
    const isStatement = Boolean(receipt.isStatement);
    const isMonthly = receipt.fee_type === 'Monthly';
    const paymentsList = receipt.paymentsList || [];

    return `
    <div class="receipt-card">
        <!-- Header (Strict Table Layout - Never Collapses or Wraps) -->
        <table class="header-table" style="width: 100%; border-collapse: collapse; border-bottom: 2.5px solid #1B2240; padding-bottom: 12px; margin-bottom: 10px; table-layout: fixed;">
            <tr>
                <td style="width: 76px; vertical-align: middle;">
                    <img src="${logoUrl}" alt="A.P. Coaching Logo" class="logo" onerror="this.style.display='none'">
                </td>
                <td style="vertical-align: middle; padding-left: 10px;">
                    <div class="title">
                        <h1>A.P. COACHING CLASSES</h1>
                        <p class="tagline">सही मार्गदर्शन, उज्जवल भविष्य की पहचान · Concept Clear, Future Secure</p>
                        <p class="sub">Classes 6th to 12th · All Subjects (Science, Commerce, Arts)</p>
                        <p class="contact">Anil Sir Campus | Director Helpline: +91 9981182741</p>
                    </div>
                </td>
                <td style="width: 215px; text-align: right; vertical-align: middle;">
                    <div class="badge-box">
                        <div class="badge">${isStatement ? (isMonthly ? 'MONTHLY STATEMENT' : 'FEES STATEMENT') : (isMonthly ? 'MONTHLY FEE RECEIPT' : 'FEE RECEIPT / रसीद')}</div>
                        <div class="receipt-no">Receipt No: ${receiptNo}</div>
                        <div class="receipt-date">Date: ${dateStr}</div>
                    </div>
                </td>
            </tr>
        </table>

        <div class="content-body">
            <!-- Student & Academic Details (Strict 2-Column Table, Non-collapsible) -->
            <table class="info-table">
                <tr>
                    <td>
                        <span class="info-label">Student Name:</span>
                        <span class="info-val">${studentName}</span>
                    </td>
                    <td>
                        <span class="info-label">Receipt Date:</span>
                        <span class="info-val">${dateStr}</span>
                    </td>
                </tr>
                <tr>
                    <td>
                        <span class="info-label">Father's Name:</span>
                        <span class="info-val">${fatherName || '-'}</span>
                    </td>
                    <td>
                        <span class="info-label">Class / Course:</span>
                        <span class="info-val">${classNameStr}</span>
                    </td>
                </tr>
                <tr>
                    <td>
                        <span class="info-label">Contact Phone:</span>
                        <span class="info-val">${phone || '-'}</span>
                    </td>
                    <td>
                        <span class="info-label">Payment Mode:</span>
                        <span class="info-val">${paymentMode}</span>
                    </td>
                </tr>
                ${studentEmail ? `
                <tr>
                    <td colspan="2">
                        <span class="info-label">Student Email:</span>
                        <span class="info-val">${studentEmail}</span>
                    </td>
                </tr>` : ''}
            </table>

            <!-- Fee Details Table -->
            ${isMonthly ? `
            <table class="fee-table">
                <thead>
                    <tr>
                        <th class="col-sno">S.No.</th>
                        <th>Particulars / विवरण</th>
                        <th class="col-amount">Amount (राशि)</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td class="col-sno">1</td>
                        <td>Monthly Tuition Fee Plan ${receipt.month_for ? `(${receipt.month_for})` : ''}</td>
                        <td class="col-amount">${formatCurrency(receipt.monthly_amount || receipt.totalFees || receipt.currentPaid)}</td>
                    </tr>
                    <tr class="paid-row">
                        <td class="col-sno">2</td>
                        <td>
                            <strong>Amount Received (वर्तमान भुगतान)</strong>
                            <span class="paid-tag">PAID ✓</span>
                        </td>
                        <td class="col-amount">${currentPaidStr}</td>
                    </tr>
                    ${receipt.dueDate ? `
                    <tr class="due-row">
                        <td class="col-sno">3</td>
                        <td>Next Monthly Due Date: ${dueDateStr}</td>
                        <td class="col-amount">-</td>
                    </tr>` : ''}
                </tbody>
            </table>
            ` : `
            <table class="fee-table">
                <thead>
                    <tr>
                        <th class="col-sno">S.No.</th>
                        <th>Particulars / विवरण</th>
                        <th class="col-amount">Amount (राशि)</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td class="col-sno">1</td>
                        <td>Total Course / Session Tuition Fees</td>
                        <td class="col-amount">${totalFeesStr}</td>
                    </tr>
                    ${previouslyPaid > 0 ? `
                    <tr>
                        <td class="col-sno">2</td>
                        <td>Previously Paid Amount (पूर्व में जमा राशि)</td>
                        <td class="col-amount">${prevPaidStr}</td>
                    </tr>` : ''}
                    <tr class="paid-row">
                        <td class="col-sno">${previouslyPaid > 0 ? 3 : 2}</td>
                        <td>
                            <strong>Amount Received (वर्तमान भुगतान)</strong>
                            <span class="paid-tag">PAID ✓</span>
                        </td>
                        <td class="col-amount">${currentPaidStr}</td>
                    </tr>
                    <tr class="due-row">
                        <td class="col-sno">${previouslyPaid > 0 ? 4 : 3}</td>
                        <td>
                            Remaining Due Fees (शेष बाकी फीस)
                            ${receipt.remainingFees > 0 && receipt.dueDate ? ` - <span style="font-size:11px; color:#475569;">Next Due Date: ${dueDateStr}</span>` : ''}
                        </td>
                        <td class="col-amount">${remainingStr}</td>
                    </tr>
                </tbody>
            </table>
            `}

            ${isStatement && paymentsList && paymentsList.length > 0 ? `
            <div style="margin: 4px 0;">
                <div style="font-size: 11.5px; font-weight: 700; color: #1B2240; margin-bottom: 3px;">Payment Transaction History:</div>
                <table class="fee-table" style="font-size: 11px;">
                    <thead>
                        <tr>
                            <th style="padding: 4px 8px;">Date</th>
                            <th style="padding: 4px 8px;">Transaction ID</th>
                            <th style="padding: 4px 8px; text-align: right;">Amount Paid</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${paymentsList.map((p, idx) => `
                        <tr>
                            <td style="padding: 4px 8px;">${formatDate(p.payment_date)}</td>
                            <td style="padding: 4px 8px;">${p.id ? String(p.id).slice(0, 8).toUpperCase() : `TXN-${idx+1}`}</td>
                            <td style="padding: 4px 8px; text-align: right; font-weight: 700; color: #065f46;">${formatCurrency(p.amount)}</td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>` : ''}

            <!-- Amount in words & payment mode -->
            <div class="meta-box">
                <div><strong>Amount in Words: </strong><span style="font-weight: 700; color: #0f172a; text-transform: capitalize;">${inWordsStr}</span></div>
                <div><strong>Payment Mode: </strong>${paymentMode} &nbsp;|&nbsp; <strong>Status: </strong>Official payment recorded in coaching system.</div>
            </div>

            <!-- Important Guidelines & Terms -->
            <div class="terms-box">
                <div class="terms-title">Important Guidelines & Terms (नियम व शर्तें):</div>
                <div>1. Fees once paid will not be refunded or transferred under any condition (फीस किसी भी परिस्थिति में वापस नहीं होगी)।</div>
                <div>2. Regular attendance, discipline, and participation in coaching periodic tests are mandatory.</div>
                <div>3. Please retain this official fee receipt safely for future reference and identity verification.</div>
                <div>4. For batch schedule or academic support, contact Director Anil Sir: <strong>+91 9981182741</strong>.</div>
            </div>
        </div>

        <!-- Stamp & Signatures (Strict Table Layout) -->
        <table style="width: 100%; border-collapse: collapse; margin-top: 10px; padding-top: 6px;">
            <tr>
                <td style="width: 160px; vertical-align: bottom;">
                    <div class="stamp-box">
                        <div style="font-size: 11.5px; font-weight: 800;">A.P. COACHING</div>
                        <div style="font-size: 10.5px; font-weight: 700;">CLASSES</div>
                        <div style="font-size: 9px; font-weight: 800; margin: 2px 0;">★ VERIFIED & PAID ★</div>
                        <div style="font-size: 8px; font-weight: 600;">ANIL SIR CAMPUS</div>
                    </div>
                </td>
                <td style="vertical-align: bottom; text-align: right;">
                    <div class="sign-box" style="display: inline-block;">
                        <div class="sign-text">Anil Sir</div>
                        <div class="sign-line"></div>
                        <div class="sign-title">Authorized Signatory / Director</div>
                        <div style="font-size: 10px; color: #64748b;">A.P. Coaching Classes</div>
                        <div style="font-size: 11.5px; color: #1B2240; font-weight: 800; margin-top: 2px;">Mob: 9981182741</div>
                    </div>
                </td>
            </tr>
        </table>

        <!-- Footer Note -->
        <div class="footer-note">
            1. Fees once paid will not be refunded or transferred under any condition. · 2. This is an official computer-generated fee receipt. Thank you!
        </div>
    </div>`;
};

// Complete standalone HTML document for iframe printing
const buildReceiptHtml = (receipt, logoUrl) => {
    const studentName = receipt.studentName || receipt.student_name || 'Student';
    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=794, initial-scale=1">
    <title>Fee Receipt - ${studentName}</title>
    <style>${getReceiptCss()}</style>
</head>
<body>
    ${buildReceiptCardHtml(receipt, logoUrl)}
</body>
</html>`;
};

// High-resolution A4 PDF Document Generator (Isolated from mobile viewport via dedicated 794px desktop container)
const generatePdfDocument = async (receipt) => {
    const logoUrl = await getLogoDataUrl();
    const cardHtml = buildReceiptCardHtml(receipt, logoUrl);
    const cssContent = getReceiptCss();

    const existingContainer = document.getElementById('apc-receipt-pdf-render-root');
    if (existingContainer) existingContainer.remove();

    const container = document.createElement('div');
    container.id = 'apc-receipt-pdf-render-root';
    container.style.cssText = [
        'position: fixed',
        'top: 0',
        'left: 0',
        'width: 794px !important',
        'min-width: 794px !important',
        'max-width: 794px !important',
        'box-sizing: border-box !important',
        'background: #ffffff !important',
        'z-index: 100000010 !important',
        'margin: 0 !important',
        'padding: 0 !important',
        'pointer-events: none !important',
        'overflow: visible !important'
    ].join(';');

    container.innerHTML = `<style>${cssContent}</style>${cardHtml}`;
    document.body.appendChild(container);

    // Wait for the logo image if still loading
    await new Promise((resolve) => {
        const img = container.querySelector('img.logo');
        if (img && !img.complete) {
            img.onload = () => setTimeout(resolve, 80);
            img.onerror = () => setTimeout(resolve, 80);
            setTimeout(resolve, 500);
        } else {
            setTimeout(resolve, 80);
        }
    });

    const cardElement = container.querySelector('.receipt-card') || container;

    const canvas = await html2canvas(cardElement, {
        scale: 2, // 2x DPI for crisp high-resolution A4
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        width: 794,
        windowWidth: 794,
        scrollX: 0,
        scrollY: 0,
        x: 0,
        y: 0,
        onclone: (clonedDoc) => {
            const clonedContainer = clonedDoc.getElementById('apc-receipt-pdf-render-root');
            if (clonedContainer) {
                clonedContainer.style.position = 'absolute';
                clonedContainer.style.top = '0px';
                clonedContainer.style.left = '0px';
                clonedContainer.style.margin = '0px';
                clonedContainer.style.padding = '0px';
            }
        }
    });

    // Remove the temporary container immediately
    container.remove();

    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
    });

    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 8;
    const maxAvailableWidth = pageWidth - (margin * 2); // 194 mm
    const maxAvailableHeight = pageHeight - (margin * 2); // 281 mm

    const canvasAspect = canvas.width / canvas.height;

    let renderWidth = maxAvailableWidth;
    let renderHeight = renderWidth / canvasAspect;

    // Strict proportional scaling: NEVER stretch or squash!
    if (renderHeight > maxAvailableHeight) {
        renderHeight = maxAvailableHeight;
        renderWidth = renderHeight * canvasAspect;
    }

    const xOffset = (pageWidth - renderWidth) / 2;
    const yOffset = (pageHeight - renderHeight) / 2;

    pdf.addImage(imgData, 'JPEG', xOffset, yOffset, renderWidth, renderHeight, undefined, 'FAST');

    const studentName = receipt.studentName || receipt.student_name || 'Student';
    const receiptNo = receipt.receiptNo || (receipt.id ? `REC-${String(receipt.id).padStart(5, '0')}` : 'APC');
    const safeName = studentName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeRec = receiptNo.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `Fee_Receipt_${safeName}_${safeRec}.pdf`;
    
    const blob = pdf.output('blob');
    const file = new File([blob], filename, { type: 'application/pdf' });

    return { pdf, blob, file, filename };
};

// Reliable, standalone print mechanism via isolated iframe
const printReceiptViaIframe = async (receipt) => {
    try {
        const existingFrame = document.getElementById('apc-receipt-print-frame');
        if (existingFrame) existingFrame.remove();

        const iframe = document.createElement('iframe');
        iframe.id = 'apc-receipt-print-frame';
        iframe.style.position = 'fixed';
        iframe.style.top = '-9999px';
        iframe.style.left = '-9999px';
        iframe.style.width = '210mm';
        iframe.style.height = '297mm';
        iframe.style.border = 'none';
        iframe.style.zIndex = '-9999';
        document.body.appendChild(iframe);

        const logoUrl = await getLogoDataUrl();
        const doc = iframe.contentWindow.document;
        doc.open();
        doc.write(buildReceiptHtml(receipt, logoUrl));
        doc.close();

        const triggerPrint = () => {
            try {
                iframe.contentWindow.focus();
                iframe.contentWindow.print();
            } catch (err) {
                console.error("Print execution failed:", err);
            }
            setTimeout(() => {
                try { iframe.remove(); } catch (_) {}
            }, 5000);
        };

        const img = iframe.contentDocument ? iframe.contentDocument.querySelector('img.logo') : null;
        if (img && !img.complete) {
            img.onload = () => setTimeout(triggerPrint, 150);
            img.onerror = () => setTimeout(triggerPrint, 150);
            setTimeout(triggerPrint, 700);
        } else {
            setTimeout(triggerPrint, 300);
        }
    } catch (e) {
        console.error("Iframe print error, falling back to window.print():", e);
        window.print();
    }
};

const FeeReceiptModal = ({ isOpen, onClose, receipt }) => {
    const cardRef = useRef(null);
    const [copied, setCopied] = useState(false);
    const [toastMsg, setToastMsg] = useState('');
    const [showShareMenu, setShowShareMenu] = useState(false);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                if (showShareMenu) setShowShareMenu(false);
                else onClose();
            }
        };
        if (isOpen) {
            window.addEventListener('keydown', handleKeyDown);
        }
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose, showShareMenu]);

    if (!isOpen || !receipt) return null;

    const showToast = (msg) => {
        setToastMsg(msg);
        setTimeout(() => setToastMsg(''), 4000);
    };

    const handlePrint = () => {
        printReceiptViaIframe(receipt);
    };

    const {
        receiptNo = `APC-${Date.now().toString().slice(-6)}`,
        date = new Date().toISOString(),
        studentName = 'Student',
        fatherName = '-',
        className = '-',
        phone = '-',
        email = '',
        currentPaid = 0,
        totalFees = 0,
        totalPaid = 0,
        remainingFees = 0,
        dueDate = null,
        paymentMode = 'Cash / Online UPI',
        isStatement = false,
        fee_type = 'Yearly',
        month_for = null,
        monthly_amount = null,
        paymentsList = []
    } = receipt;

    // Previously paid before this payment
    const previouslyPaid = Math.max(0, (totalPaid || currentPaid) - currentPaid);

    const getCleanPhone = (phoneStr) => {
        if (!phoneStr) return '';
        const digits = String(phoneStr).replace(/\D/g, '');
        if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
        if (digits.length === 10) return digits;
        if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
        return digits.length >= 10 ? digits.slice(-10) : '';
    };

    const cleanPhone = getCleanPhone(phone);

    const handleWhatsAppClick = () => {
        if (cleanPhone) {
            setShowShareMenu(true);
        } else {
            handleWhatsAppPdf('');
        }
    };

    const handleWhatsAppPdf = async (targetPhone = '') => {
        try {
            setIsGeneratingPdf(true);
            showToast('📄 Generating Official PDF Receipt...');
            const { file, filename, pdf } = await generatePdfDocument(receipt);
            setIsGeneratingPdf(false);

            // 1. Mobile browsers (Android/iOS) with native file sharing support: sends the real PDF document straight to WhatsApp!
            if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [file] })) {
                try {
                    await navigator.share({
                        files: [file],
                        title: `Fee Receipt - ${studentName}`,
                        text: `A.P. Coaching Classes Fee Receipt for ${studentName}`
                    });
                    showToast('✓ PDF shared successfully!');
                    setShowShareMenu(false);
                    return;
                } catch (err) {
                    if (err.name === 'AbortError') return;
                    console.warn("navigator.share failed, using fallback:", err);
                }
            }

            // 2. Desktop WhatsApp Web / PC fallback: automatically download the PDF file and open WhatsApp chat
            pdf.save(filename);

            const text = `Namaste! A.P. Coaching Classes Fee Receipt for ${studentName} (Class ${className || '-'}). Receipt No: ${receiptNo}. Please find the attached PDF receipt file.`;
            const encoded = encodeURIComponent(text);
            const phoneToUse = targetPhone !== undefined ? targetPhone : cleanPhone;
            let waUrl = `https://api.whatsapp.com/send?text=${encoded}`;
            if (phoneToUse) {
                waUrl = `https://wa.me/91${phoneToUse}?text=${encoded}`;
            }
            window.open(waUrl, '_blank');

            showToast(`📄 PDF downloaded (${filename})! WhatsApp chat open ho gaya hai, download folder se PDF attach karke send karein.`);
            setShowShareMenu(false);
        } catch (err) {
            console.error("PDF generation/sharing error:", err);
            setIsGeneratingPdf(false);
            showToast("PDF generate karne me samasya aayi. Kripya Print option se PDF save karein.");
        }
    };

    const handleDownloadPdf = async () => {
        try {
            setIsGeneratingPdf(true);
            showToast('📄 Generating Fee Receipt PDF...');
            const { pdf, filename } = await generatePdfDocument(receipt);
            pdf.save(filename);
            setIsGeneratingPdf(false);
            showToast(`✓ PDF downloaded: ${filename}`);
            setShowShareMenu(false);
        } catch (err) {
            console.error("Download PDF error:", err);
            setIsGeneratingPdf(false);
            showToast("PDF generate karne me samasya aayi.");
        }
    };

    const handleSharePdf = async () => {
        try {
            setIsGeneratingPdf(true);
            showToast('📄 Preparing PDF for sharing...');
            const { file, filename, pdf } = await generatePdfDocument(receipt);
            setIsGeneratingPdf(false);

            if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [file] })) {
                try {
                    await navigator.share({
                        files: [file],
                        title: `Fee Receipt - ${studentName}`,
                        text: `A.P. Coaching Classes Fee Receipt for ${studentName}`
                    });
                    setShowShareMenu(false);
                    return;
                } catch (err) {
                    if (err.name === 'AbortError') return;
                }
            }
            pdf.save(filename);
            showToast(`✓ PDF downloaded to device: ${filename}`);
            setShowShareMenu(false);
        } catch (err) {
            console.error("Share PDF error:", err);
            setIsGeneratingPdf(false);
            showToast("PDF generate karne me samasya aayi.");
        }
    };

    const handleCopyText = () => {
        const text = generateReceiptShareText(receipt);
        try {
            if (navigator?.clipboard?.writeText) {
                navigator.clipboard.writeText(text);
                setCopied(true);
                showToast('✓ Receipt text summary copied to clipboard!');
                setTimeout(() => setCopied(false), 2000);
            } else {
                showToast('Unable to copy automatically.');
            }
        } catch {
            showToast('Unable to copy automatically.');
        }
        setShowShareMenu(false);
    };

    const modalContent = (
        <div className={styles.modalOverlay} onClick={onClose}>
            <div className={styles.modalContainer} onClick={(e) => e.stopPropagation()}>
                {/* On-screen Action Bar */}
                <div className={styles.actionBar}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontWeight: '700', color: '#1B2240', fontSize: '1rem' }}>
                            {isStatement ? 'Fee Statement Preview' : 'Fee Receipt Preview (रसीद)'}
                        </span>
                    </div>
                    <div className={styles.actionBtnGroup}>
                        <button 
                            onClick={handleWhatsAppClick} 
                            disabled={isGeneratingPdf}
                            className={styles.whatsappBtn} 
                            type="button"
                            title="WhatsApp par PDF receipt send karein"
                        >
                            {isGeneratingPdf ? <Loader2 size={16} className="animate-spin" /> : <MessageCircle size={16} />}
                            <span>WhatsApp PDF</span>
                        </button>
                        <button 
                            onClick={handleDownloadPdf} 
                            disabled={isGeneratingPdf}
                            className={styles.downloadBtn} 
                            type="button"
                            title="Receipt ko PDF file ke roop me download karein"
                        >
                            {isGeneratingPdf ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                            <span>Download PDF</span>
                        </button>
                        <button 
                            onClick={handleSharePdf} 
                            disabled={isGeneratingPdf}
                            className={styles.shareBtn} 
                            type="button"
                            title="Device apps me PDF share karein"
                        >
                            <Share2 size={16} />
                            <span>Share</span>
                        </button>
                        <button onClick={handlePrint} className={styles.printBtn} type="button" title="Full A4 page print karein ya save karein">
                            <Printer size={16} />
                            <span>Print</span>
                        </button>
                        <button onClick={onClose} className={styles.closeBtn} type="button" title="Close">
                            <X size={17} />
                        </button>
                    </div>
                </div>

                {/* Visible Receipt Card */}
                <div id="receipt-card-element" ref={cardRef} className={styles.receiptCard}>
                    {/* Header */}
                    <div className={styles.headerSection}>
                        <div className={styles.logoArea}>
                            <img 
                                src="/logo.jpeg" 
                                alt="A.P. Coaching Logo" 
                                className={styles.coachingLogo} 
                                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                            />
                            <div className={styles.titleArea}>
                                <h1>A.P. COACHING CLASSES</h1>
                                <p className={styles.tagline}>सही मार्गदर्शन, उज्जवल भविष्य की पहचान · Concept Clear, Future Secure</p>
                                <p className={styles.subDetails}>Classes 6th to 12th · All Subjects (Science, Commerce, Arts)</p>
                                <p className={styles.subDetails} style={{ color: '#1B2240', fontWeight: '700' }}>Anil Sir Mob: +91 9981182741</p>
                            </div>
                        </div>
                        <div className={styles.receiptBadgeArea}>
                            <div className={styles.receiptBadge}>
                                {isStatement ? (fee_type === 'Monthly' ? 'MONTHLY STATEMENT' : 'FEES STATEMENT') : (fee_type === 'Monthly' ? 'MONTHLY FEE RECEIPT / मासिक रसीद' : 'FEE RECEIPT / रसीद')}
                            </div>
                            <div className={styles.receiptNo}>Receipt No: {receiptNo}</div>
                        </div>
                    </div>

                    {/* Student & Date Info */}
                    <div className={styles.infoGrid}>
                        <div className={styles.infoItem}>
                            <span className={styles.infoLabel}>Student Name:</span>
                            <span className={styles.infoValue}>{studentName}</span>
                        </div>
                        <div className={styles.infoItem}>
                            <span className={styles.infoLabel}>Receipt Date:</span>
                            <span className={styles.infoValue}>{formatDate(date)}</span>
                        </div>
                        <div className={styles.infoItem}>
                            <span className={styles.infoLabel}>Father's Name:</span>
                            <span className={styles.infoValue}>{fatherName || '-'}</span>
                        </div>
                        <div className={styles.infoItem}>
                            <span className={styles.infoLabel}>Class:</span>
                            <span className={styles.infoValue}>
                                {className ? (String(className).toLowerCase().includes('class') ? className : `Class ${className}`) : '-'}
                            </span>
                        </div>
                        <div className={styles.infoItem}>
                            <span className={styles.infoLabel}>Contact Phone:</span>
                            <span className={styles.infoValue}>{phone || '-'}</span>
                        </div>
                        {email && (
                            <div className={styles.infoItem}>
                                <span className={styles.infoLabel}>Student Email:</span>
                                <span className={styles.infoValue}>{email}</span>
                            </div>
                        )}
                    </div>

                    {/* Fee Details Table */}
                    {fee_type === 'Monthly' ? (
                        <table className={styles.feeTable}>
                            <thead>
                                <tr>
                                    <th style={{ width: '60px' }}>S.No.</th>
                                    <th>Particulars / विवरण</th>
                                    <th style={{ width: '160px' }}>Amount (राशि)</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>1</td>
                                    <td>Monthly Tuition Fee Plan {month_for ? `(${month_for})` : ''}</td>
                                    <td>{formatCurrency(monthly_amount || totalFees || currentPaid)}</td>
                                </tr>
                                <tr className={styles.paidHighlightRow}>
                                    <td>2</td>
                                    <td>
                                        <strong>Amount Received (वर्तमान भुगतान)</strong>
                                        <span className={styles.paidTag}>PAID ✓</span>
                                    </td>
                                    <td>{formatCurrency(currentPaid)}</td>
                                </tr>
                                {dueDate && (
                                    <tr className={styles.remainingRow}>
                                        <td>3</td>
                                        <td>
                                            Next Monthly Due Date: {formatDate(dueDate)}
                                        </td>
                                        <td>-</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    ) : (
                        <table className={styles.feeTable}>
                            <thead>
                                <tr>
                                    <th style={{ width: '60px' }}>S.No.</th>
                                    <th>Particulars / विवरण</th>
                                    <th style={{ width: '160px' }}>Amount (राशि)</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>1</td>
                                    <td>Total Course / Session Tuition Fees</td>
                                    <td>{formatCurrency(totalFees)}</td>
                                </tr>
                                {previouslyPaid > 0 && (
                                    <tr>
                                        <td>2</td>
                                        <td>Previously Paid Amount (पूर्व में जमा राशि)</td>
                                        <td>{formatCurrency(previouslyPaid)}</td>
                                    </tr>
                                )}
                                <tr className={styles.paidHighlightRow}>
                                    <td>{previouslyPaid > 0 ? 3 : 2}</td>
                                    <td>
                                        <strong>Amount Received (वर्तमान भुगतान)</strong>
                                        <span className={styles.paidTag}>PAID ✓</span>
                                    </td>
                                    <td>{formatCurrency(currentPaid)}</td>
                                </tr>
                                <tr className={styles.remainingRow}>
                                    <td>{previouslyPaid > 0 ? 4 : 3}</td>
                                    <td>
                                        Remaining Due Fees (शेष बाकी फीस)
                                        {remainingFees > 0 && dueDate && (
                                            <span style={{ fontSize: '0.8rem', color: '#b91c1c', display: 'block', fontWeight: '500' }}>
                                                Next Due Date: {formatDate(dueDate)}
                                            </span>
                                        )}
                                    </td>
                                    <td>{formatCurrency(remainingFees)}</td>
                                </tr>
                            </tbody>
                        </table>
                    )}

                    {/* Statement Details if available */}
                    {isStatement && paymentsList && paymentsList.length > 0 && (
                        <div style={{ marginBottom: '1.25rem' }}>
                            <div style={{ fontSize: '0.85rem', fontWeight: '700', color: '#1B2240', marginBottom: '0.4rem' }}>
                                Payment Transaction History:
                            </div>
                            <table className={styles.feeTable} style={{ fontSize: '0.82rem' }}>
                                <thead>
                                    <tr>
                                        <th style={{ padding: '4px 8px' }}>Date</th>
                                        <th style={{ padding: '4px 8px' }}>Transaction ID</th>
                                        <th style={{ padding: '4px 8px', textAlign: 'right' }}>Amount Paid</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paymentsList.map((p, idx) => (
                                        <tr key={p.id || idx}>
                                            <td style={{ padding: '4px 8px' }}>{formatDate(p.payment_date)}</td>
                                            <td style={{ padding: '4px 8px' }}>{p.id ? String(p.id).slice(0, 8).toUpperCase() : `TXN-${idx+1}`}</td>
                                            <td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: '600', color: '#065f46' }}>
                                                {formatCurrency(p.amount)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Words & Mode */}
                    <div className={styles.metaBox}>
                        <div>
                            <strong style={{ color: '#475569' }}>Amount in Words: </strong>
                            <span style={{ fontWeight: '700', color: '#0f172a' }}>{numberToWordsIndian(currentPaid)}</span>
                        </div>
                        <div>
                            <strong style={{ color: '#475569' }}>Payment Mode: </strong>
                            <span style={{ color: '#0f172a' }}>{paymentMode}</span>
                            <span style={{ color: '#64748b', marginLeft: '8px' }}>● Official payment verified & recorded</span>
                        </div>
                    </div>

                    {/* Guidelines & Terms */}
                    <div className={styles.termsBox}>
                        <div className={styles.termsTitle}>Important Guidelines & Terms (नियम व शर्तें):</div>
                        <div>1. Fees once paid will not be refunded or transferred under any condition (फीस किसी भी स्थिति में वापस नहीं होगी)।</div>
                        <div>2. Regular attendance, discipline, and participation in periodic tests are mandatory.</div>
                        <div>3. Please retain this official fee receipt safely for future reference and verification.</div>
                        <div>4. For batch schedule or academic support, contact Director Anil Sir: <strong>+91 9981182741</strong>.</div>
                    </div>

                    {/* Stamp and Signature */}
                    <div className={styles.bottomSection}>
                        <div className={styles.stampBox}>
                            <span>A.P. Coaching</span>
                            <span>Classes</span>
                            <span style={{ fontSize: '0.62rem', color: '#047857' }}>● VERIFIED & PAID ●</span>
                        </div>
                        <div className={styles.signatureBox}>
                            <div className={styles.signatureLine}>Anil Sir</div>
                            <div className={styles.signatureDivider}></div>
                            <div className={styles.signatureTitle}>Authorized Signatory / Director</div>
                            <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>A.P. Coaching Classes</div>
                            <div style={{ fontSize: '0.74rem', color: '#1B2240', fontWeight: 'bold', marginTop: '2px' }}>Mob: 9981182741</div>
                        </div>
                    </div>

                    {/* Footer Note */}
                    <div className={styles.footerNote}>
                        <div>1. Fees once paid will not be refunded or transferred under any condition.</div>
                        <div>2. This is an official computer-generated fee receipt. Thank you!</div>
                    </div>
                </div>

                {/* Share Options Popup Modal */}
                {showShareMenu && (
                    <div className={styles.shareMenuOverlay} onClick={() => setShowShareMenu(false)}>
                        <div className={styles.shareMenuCard} onClick={(e) => e.stopPropagation()}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>
                                <div style={{ fontWeight: '700', color: '#1B2240', fontSize: '1rem' }}>Share Fee Receipt</div>
                                <button onClick={() => setShowShareMenu(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                                    <X size={18} />
                                </button>
                            </div>
                            <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                                Student: <strong style={{ color: '#0f172a' }}>{studentName}</strong> {className && className !== '-' ? `(${String(className).toLowerCase().includes('class') ? className : `Class ${className}`})` : ''}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.25rem' }}>
                                {cleanPhone && (
                                    <button
                                        onClick={() => handleWhatsAppPdf(cleanPhone)}
                                        className={styles.whatsappBtn}
                                        style={{ justifyContent: 'center', padding: '0.65rem' }}
                                        type="button"
                                        disabled={isGeneratingPdf}
                                    >
                                        {isGeneratingPdf ? <Loader2 size={18} className="animate-spin" /> : <MessageCircle size={18} />}
                                        <span>Send PDF to Student (+91 {cleanPhone})</span>
                                    </button>
                                )}
                                <button
                                    onClick={() => handleWhatsAppPdf('')}
                                    className={styles.whatsappBtn}
                                    style={{ background: '#25D366', justifyContent: 'center', padding: '0.65rem' }}
                                    type="button"
                                    disabled={isGeneratingPdf}
                                >
                                    {isGeneratingPdf ? <Loader2 size={18} className="animate-spin" /> : <MessageCircle size={18} />}
                                    <span>Share PDF to Any WhatsApp Chat / Group</span>
                                </button>
                                <button
                                    onClick={handleDownloadPdf}
                                    className={styles.downloadBtn}
                                    style={{ justifyContent: 'center', padding: '0.65rem' }}
                                    type="button"
                                    disabled={isGeneratingPdf}
                                >
                                    {isGeneratingPdf ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
                                    <span>Download Receipt PDF File</span>
                                </button>
                                <button
                                    onClick={handleSharePdf}
                                    className={styles.shareBtn}
                                    style={{ justifyContent: 'center', padding: '0.65rem' }}
                                    type="button"
                                    disabled={isGeneratingPdf}
                                >
                                    <Share2 size={18} />
                                    <span>Share PDF via Device (Other Apps)</span>
                                </button>
                                <button
                                    onClick={handleCopyText}
                                    className={styles.copyBtn}
                                    style={{ justifyContent: 'center', padding: '0.65rem' }}
                                    type="button"
                                >
                                    {copied ? <Check size={16} color="#10b981" /> : <Copy size={16} />}
                                    <span>{copied ? 'Copied to Clipboard!' : 'Copy Receipt Summary (Text)'}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Floating Toast Notification */}
                {toastMsg && (
                    <div className={styles.toastNotification}>
                        <Check size={16} color="#10b981" />
                        <span>{toastMsg}</span>
                    </div>
                )}
            </div>
        </div>
    );

    // Mount modal directly onto document.body using React Portal
    return typeof document !== 'undefined' ? ReactDOM.createPortal(modalContent, document.body) : modalContent;
};

export default FeeReceiptModal;
