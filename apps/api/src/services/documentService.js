import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle } from "docx";
import { logger } from "../utils/logger.js";

/**
 * DocumentService
 * 
 * Centralized service for generating professional museum documents in both HTML (for preview) 
 * and DOCX (for formal export/printing).
 */
export const documentService = {
    
    // ==========================================
    // 1. MEMORANDUM OF AGREEMENT (MOA)
    // ==========================================
    
    async generateMOA(intake, format = 'html', overrides = {}) {
        const data = {
            donorName: overrides.donorName || intake.donor_name_override || intake.donor_info,
            itemName: intake.proposed_item_name,
            method: intake.acquisition_method,
            date: new Date().toLocaleDateString(undefined, { dateStyle: 'long' }),
            loanDuration: overrides.loanDuration || intake.loan_duration_override || 'N/A'
        };

        if (format === 'docx') {
            return await this._buildMOADOCX(data);
        }
        return this._buildMOAHTML(data);
    },

    _buildMOAHTML(data) {
        return `
            <div style="font-family: 'Times New Roman', serif; padding: 50px; color: #000; line-height: 1.6; max-width: 800px; margin: 0 auto; background: white; border: 1px solid #eee;">
                <div style="text-align: center; margin-bottom: 40px; border-bottom: 2px solid #000; padding-bottom: 20px;">
                    <div style="font-size: 24px; font-weight: bold; letter-spacing: 2px;">MUSEO BULAWAN</div>
                    <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #444;">Office of the Curator • Acquisition Division</div>
                </div>

                <h1 style="text-align: center; font-size: 20px; text-decoration: underline; margin-bottom: 40px;">
                    MEMORANDUM OF AGREEMENT: ${data.method.toUpperCase()}
                </h1>

                <p>This Agreement is entered into this <strong>${data.date}</strong> by and between:</p>

                <p style="margin-left: 40px;">
                    <strong>MUSEO BULAWAN</strong>, represented herein by its Authorized Representative, hereinafter referred to as the "MUSEUM".
                </p>
                <p style="text-align: center; font-style: italic;">- and -</p>
                <p style="margin-left: 40px;">
                    <strong>${data.donorName}</strong>, hereinafter referred to as the "TRANSFEROR".
                </p>

                <div style="margin-top: 40px;">
                    <h3 style="font-size: 16px; border-bottom: 1px solid #ccc; padding-bottom: 5px;">I. OBJECT OF TRANSFER</h3>
                    <p>The Transferor hereby agrees to transfer the following object(s) to the Museum under the terms of <strong>${data.method.toUpperCase()}</strong>:</p>
                    <div style="background: #f5f5f5; padding: 15px; border: 1px solid #ddd; margin: 10px 0;">
                        <strong>Artifact Name:</strong> ${data.itemName}<br/>
                        <strong>Method:</strong> ${data.method.toUpperCase()}
                        ${data.method === 'loan' ? `<br/><strong>Duration:</strong> ${data.loanDuration}` : ''}
                    </div>
                </div>

                <div style="margin-top: 30px;">
                    <h3 style="font-size: 16px; border-bottom: 1px solid #ccc; padding-bottom: 5px;">II. TERMS AND CONDITIONS</h3>
                    <ol style="font-size: 14px;">
                        <li>The Transferor warrants that they are the legal owner of the object and has full authority to enter into this agreement.</li>
                        <li>The Museum agrees to provide professional care, storage, and preservation in accordance with institutional standards.</li>
                        <li>${data.method === 'gift' ? 'Ownership is transferred permanently to the Museum.' : 'The Museum shall maintain custody for the duration specified in Section I.'}</li>
                    </ol>
                </div>

                <div style="margin-top: 80px; display: flex; justify-content: space-between;">
                    <div style="width: 250px; border-top: 1px solid #000; text-align: center; padding-top: 10px;">
                        <div style="font-size: 12px; font-weight: bold;">${data.donorName}</div>
                        <div style="font-size: 10px; color: #666;">TRANSFEROR / REPRESENTATIVE</div>
                    </div>
                    <div style="width: 250px; border-top: 1px solid #000; text-align: center; padding-top: 10px;">
                        <div style="font-size: 12px; font-weight: bold;">MUSEO BULAWAN REGISTRAR</div>
                        <div style="font-size: 10px; color: #666;">AUTHORIZED SIGNATORY</div>
                    </div>
                </div>
            </div>
        `;
    },

    async _buildMOADOCX(data) {
        const doc = new Document({
            sections: [{
                children: [
                    new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                            new TextRun({ text: "MUSEO BULAWAN", bold: true, size: 32 }),
                            new TextRun({ break: 1, text: "Office of the Curator • Acquisition Division", size: 20 }),
                        ],
                    }),
                    new Paragraph({ border: { bottom: { color: "auto", space: 1, style: BorderStyle.SINGLE, size: 6 } } }),
                    new Paragraph({ break: 1 }),
                    new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                            new TextRun({ text: `MEMORANDUM OF AGREEMENT: ${data.method.toUpperCase()}`, bold: true, underline: {}, size: 24 }),
                        ],
                    }),
                    new Paragraph({ break: 1 }),
                    new Paragraph({
                        children: [
                            new TextRun({ text: `This Agreement is entered into this ` }),
                            new TextRun({ text: data.date, bold: true }),
                            new TextRun({ text: " by and between:" }),
                        ],
                    }),
                    new Paragraph({ break: 1 }),
                    new Paragraph({
                        indent: { left: 720 },
                        children: [
                            new TextRun({ text: "MUSEO BULAWAN", bold: true }),
                            new TextRun({ text: ", represented herein by its Authorized Representative, hereinafter referred to as the \"MUSEUM\"." }),
                        ],
                    }),
                    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "- and -", italics: true })] }),
                    new Paragraph({
                        indent: { left: 720 },
                        children: [
                            new TextRun({ text: data.donorName, bold: true }),
                            new TextRun({ text: ", hereinafter referred to as the \"TRANSFEROR\"." }),
                        ],
                    }),
                    new Paragraph({ break: 1 }),
                    new Paragraph({
                        heading: HeadingLevel.HEADING_3,
                        children: [new TextRun({ text: "I. OBJECT OF TRANSFER", bold: true, size: 20 })],
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({ text: `The Transferor hereby agrees to transfer the following object(s) to the Museum under the terms of ` }),
                            new TextRun({ text: data.method.toUpperCase(), bold: true }),
                            new TextRun({ text: ":" }),
                        ],
                    }),
                    new Paragraph({
                        indent: { left: 360 },
                        children: [
                            new TextRun({ text: `Artifact Name: ${data.itemName}`, break: 1 }),
                            new TextRun({ text: `Method: ${data.method.toUpperCase()}`, break: 1 }),
                            ...(data.method === 'loan' ? [new TextRun({ text: `Duration: ${data.loanDuration}`, break: 1 })] : []),
                        ],
                    }),
                    new Paragraph({ break: 1 }),
                    new Paragraph({
                        heading: HeadingLevel.HEADING_3,
                        children: [new TextRun({ text: "II. TERMS AND CONDITIONS", bold: true, size: 20 })],
                    }),
                    new Paragraph({ text: "1. The Transferor warrants that they are the legal owner of the object and has full authority to enter into this agreement." }),
                    new Paragraph({ text: "2. The Museum agrees to provide professional care, storage, and preservation in accordance with institutional standards." }),
                    new Paragraph({ text: `3. ${data.method === 'gift' ? 'Ownership is transferred permanently to the Museum.' : 'The Museum shall maintain custody for the duration specified in Section I.'}` }),
                    
                    new Paragraph({ break: 4 }),
                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        borders: {
                            top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
                            insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE },
                        },
                        rows: [
                            new TableRow({
                                children: [
                                    new TableCell({
                                        children: [
                                            new Paragraph({ border: { top: { style: BorderStyle.SINGLE, size: 1 } }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: data.donorName, bold: true, size: 18 })] }),
                                            new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "TRANSFEROR / REPRESENTATIVE", size: 14 })] }),
                                        ],
                                    }),
                                    new TableCell({ children: [new Paragraph({ text: "" })] }), // Spacer
                                    new TableCell({
                                        children: [
                                            new Paragraph({ border: { top: { style: BorderStyle.SINGLE, size: 1 } }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: "MUSEO BULAWAN REGISTRAR", bold: true, size: 18 })] }),
                                            new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "AUTHORIZED SIGNATORY", size: 14 })] }),
                                        ],
                                    }),
                                ],
                            }),
                        ],
                    }),
                ],
            }],
        });

        return await Packer.toBuffer(doc);
    },

    // ==========================================
    // 2. FORMAL ACCESSION REPORT
    // ==========================================

    async generateAccessionReport(accession, intake, format = 'html') {
        const data = {
            accNum: accession.accession_number,
            regDate: new Date(accession.created_at || new Date()).toLocaleDateString(undefined, { dateStyle: 'long' }),
            itemName: intake.proposed_item_name,
            method: intake.acquisition_method,
            legalStatus: accession.legal_status,
            contractType: accession.contract_type,
            maker: accession.maker || 'Not Recorded',
            period: accession.period_era || 'Not Recorded',
            type: accession.object_type || 'Not Recorded',
            classification: accession.classification || 'Not Recorded',
            dimensions: accession.dimensions || 'Not Recorded',
            materials: accession.materials || 'Not Recorded',
            significance: accession.historical_significance || 'No significant historical data recorded.',
            // Rights Management
            copyright: accession.copyright_holder || 'Public Domain / Unknown',
            license: accession.usage_license || 'No formal license recorded',
            restrictions: accession.usage_restrictions || 'None',
            creditLine: accession.credit_line || 'Museo Bulawan Collection'
        };

        if (format === 'docx') {
            return await this._buildAccessionDOCX(data);
        }
        return this._buildAccessionHTML(data);
    },

    _buildAccessionHTML(data) {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    body { font-family: 'Inter', sans-serif; padding: 50px; color: #1a1a1a; line-height: 1.5; max-width: 800px; margin: 0 auto; }
                    .header { border-bottom: 3px solid #000; padding-bottom: 15px; margin-bottom: 40px; display: flex; justify-content: space-between; align-items: flex-end; }
                    .logo { font-size: 28px; font-weight: 800; letter-spacing: -1.5px; color: #000; }
                    .report-title { text-align: center; font-size: 32px; font-weight: 800; margin-bottom: 50px; text-transform: uppercase; letter-spacing: 4px; border: 2px solid #000; padding: 10px; }
                    .section { margin-bottom: 35px; }
                    .section-title { font-size: 14px; font-weight: 800; background: #000; color: #fff; padding: 6px 12px; margin-bottom: 20px; text-transform: uppercase; }
                    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 25px; }
                    .label { font-size: 9px; text-transform: uppercase; color: #888; font-weight: 800; }
                    .value { font-size: 15px; font-weight: 500; border-bottom: 1px solid #eee; }
                    .notes-box { background: #f9f9f9; padding: 20px; border-left: 4px solid #ddd; font-style: italic; }
                    .rights-box { border: 1px solid #eee; padding: 15px; margin-top: 10px; font-size: 13px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="logo">MUSEO BULAWAN</div>
                    <div style="font-size: 12px; font-weight: bold; color: #666;">OFFICE OF THE REGISTRAR</div>
                </div>
                <div class="report-title">Accession Record</div>
                <div class="section">
                    <div class="section-title">I. Administrative Data</div>
                    <div class="grid">
                        <div><div class="label">Accession Number</div><div class="value">${data.accNum}</div></div>
                        <div><div class="label">Registration Date</div><div class="value">${data.regDate}</div></div>
                        <div><div class="label">Legal Status</div><div class="value">${data.legalStatus}</div></div>
                        <div><div class="label">Contract Framework</div><div class="value">${data.contractType.toUpperCase()}</div></div>
                    </div>
                </div>
                <div class="section">
                    <div class="section-title">II. Artifact Specification</div>
                    <div class="grid">
                        <div><div class="label">Object Name</div><div class="value">${data.itemName}</div></div>
                        <div><div class="label">Maker</div><div class="value">${data.maker}</div></div>
                        <div><div class="label">Period</div><div class="value">${data.period}</div></div>
                        <div><div class="label">Classification</div><div class="value">${data.classification}</div></div>
                    </div>
                    <div style="margin-top: 20px;">
                        <div class="label">Historical Significance</div>
                        <div class="notes-box">${data.significance}</div>
                    </div>
                </div>
                <div class="section">
                    <div class="section-title">III. Rights Management & Intellectual Property</div>
                    <div class="grid">
                        <div><div class="label">Copyright Holder</div><div class="value">${data.copyright}</div></div>
                        <div><div class="label">Usage License</div><div class="value">${data.license}</div></div>
                    </div>
                    <div style="margin-top: 20px;">
                        <div class="label">Credit Line (Institutional Citation)</div>
                        <div class="rights-box">${data.creditLine}</div>
                    </div>
                    <div style="margin-top: 10px;">
                        <div class="label">Usage Restrictions</div>
                        <div style="font-size: 12px; color: #c00;">${data.restrictions}</div>
                    </div>
                </div>
            </body>
            </html>
        `;
    },

    async _buildAccessionDOCX(data) {
        const doc = new Document({
            sections: [{
                children: [
                    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "MUSEO BULAWAN", bold: true, size: 36 })] }),
                    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "OFFICE OF THE REGISTRAR", size: 20 })] }),
                    new Paragraph({ break: 1 }),
                    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "ACCESSION RECORD", bold: true, size: 28 })] }),
                    new Paragraph({ break: 1 }),
                    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: "I. ADMINISTRATIVE DATA", bold: true })] }),
                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        rows: [
                            new TableRow({
                                children: [
                                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Accession Number:", bold: true }), new TextRun({ text: ` ${data.accNum}` })] })] }),
                                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Registration Date:", bold: true }), new TextRun({ text: ` ${data.regDate}` })] })] }),
                                ],
                            }),
                            new TableRow({
                                children: [
                                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Legal Status:", bold: true }), new TextRun({ text: ` ${data.legalStatus}` })] })] }),
                                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Contract Type:", bold: true }), new TextRun({ text: ` ${data.contractType.toUpperCase()}` })] })] }),
                                ],
                            }),
                        ],
                    }),
                    new Paragraph({ break: 1 }),
                    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: "II. ARTIFACT SPECIFICATION", bold: true })] }),
                    new Paragraph({ children: [new TextRun({ text: "Object Name: ", bold: true }), new TextRun({ text: data.itemName })] }),
                    new Paragraph({ children: [new TextRun({ text: "Maker/Creator: ", bold: true }), new TextRun({ text: data.maker })] }),
                    new Paragraph({ children: [new TextRun({ text: "Period/Era: ", bold: true }), new TextRun({ text: data.period })] }),
                    new Paragraph({ children: [new TextRun({ text: "Classification: ", bold: true }), new TextRun({ text: data.classification })] }),
                    new Paragraph({ break: 1 }),
                    new Paragraph({ children: [new TextRun({ text: "Historical Significance & Provenance:", bold: true })] }),
                    new Paragraph({ children: [new TextRun({ text: data.significance, italics: true })] }),
                ],
            }],
        });

        return await Packer.toBuffer(doc);
    },

    // ==========================================
    // 3. INVENTORY STATUS REPORT
    // ==========================================

    async generateInventoryReport(inventory, accession, intake, movement = [], format = 'html') {
        const data = {
            catNum: inventory.catalog_number,
            status: inventory.status.replace(/_/g, ' ').toUpperCase(),
            location: inventory.current_location || 'Not Assigned',
            accNum: accession.accession_number,
            itemName: intake.proposed_item_name,
            maker: accession.maker || 'Not Recorded',
            dimensions: accession.dimensions || 'Not Recorded',
            materials: accession.materials || 'Not Recorded',
            lastUpdated: new Date(inventory.updated_at || new Date()).toLocaleDateString(undefined, { dateStyle: 'long' }),
            movement: movement.slice(0, 5).map(m => ({
                date: new Date(m.created_at).toLocaleDateString(),
                to: m.to_location,
                reason: m.reason || 'General Rotation'
            }))
        };

        if (format === 'docx') {
            return await this._buildInventoryDOCX(data);
        }
        return this._buildInventoryHTML(data);
    },

    _buildInventoryHTML(data) {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    body { font-family: 'Inter', sans-serif; padding: 50px; color: #1a1a1a; line-height: 1.5; max-width: 800px; margin: 0 auto; }
                    .header { border-bottom: 3px solid #000; padding-bottom: 15px; margin-bottom: 40px; display: flex; justify-content: space-between; align-items: flex-end; }
                    .logo { font-size: 28px; font-weight: 800; letter-spacing: -1.5px; color: #000; }
                    .report-title { text-align: center; font-size: 32px; font-weight: 800; margin-bottom: 50px; text-transform: uppercase; letter-spacing: 4px; border: 2px solid #000; padding: 10px; }
                    .status-badge { display: inline-block; padding: 4px 12px; background: #000; color: #fff; font-size: 12px; font-weight: 800; border-radius: 4px; }
                    .section { margin-bottom: 35px; }
                    .section-title { font-size: 14px; font-weight: 800; border-bottom: 2px solid #eee; padding-bottom: 5px; margin-bottom: 20px; text-transform: uppercase; }
                    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 25px; }
                    .label { font-size: 9px; text-transform: uppercase; color: #888; font-weight: 800; }
                    .value { font-size: 15px; font-weight: 500; border-bottom: 1px solid #eee; }
                    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                    th { text-align: left; font-size: 10px; text-transform: uppercase; color: #888; border-bottom: 1px solid #eee; padding: 8px 0; }
                    td { font-size: 13px; padding: 12px 0; border-bottom: 1px solid #f5f5f5; }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="logo">MUSEO BULAWAN</div>
                    <div style="font-size: 12px; font-weight: bold; color: #666;">COLLECTION MANAGEMENT SYSTEM</div>
                </div>
                <div class="report-title">Inventory Status Report</div>
                
                <div style="text-align: right; margin-bottom: 30px;">
                    <div class="status-badge">${data.status}</div>
                    <div style="font-size: 10px; color: #888; margin-top: 5px;">As of ${data.lastUpdated}</div>
                </div>

                <div class="section">
                    <div class="section-title">I. Catalog Identification</div>
                    <div class="grid">
                        <div><div class="label">Catalog Number</div><div class="value" style="font-weight: 800;">#${data.catNum}</div></div>
                        <div><div class="label">Accession Reference</div><div class="value">${data.accNum}</div></div>
                        <div><div class="label">Current Location</div><div class="value">${data.location}</div></div>
                        <div><div class="label">Object Name</div><div class="value">${data.itemName}</div></div>
                    </div>
                </div>

                <div class="section">
                    <div class="section-title">II. Specification</div>
                    <div class="grid">
                        <div><div class="label">Dimensions</div><div class="value">${data.dimensions}</div></div>
                        <div><div class="label">Materials</div><div class="value">${data.materials}</div></div>
                    </div>
                </div>

                <div class="section">
                    <div class="section-title">III. Recent Movement Log</div>
                    <table>
                        <thead>
                            <tr><th>Date</th><th>Target Location</th><th>Reason</th></tr>
                        </thead>
                        <tbody>
                            ${data.movement.map(m => `
                                <tr>
                                    <td>${m.date}</td>
                                    <td>${m.to}</td>
                                    <td>${m.reason}</td>
                                </tr>
                            `).join('')}
                            ${data.movement.length === 0 ? '<tr><td colspan="3" style="text-align:center; color:#999; padding:20px;">No movement history recorded.</td></tr>' : ''}
                        </tbody>
                    </table>
                </div>
            </body>
            </html>
        `;
    },

    async _buildInventoryDOCX(data) {
        const doc = new Document({
            sections: [{
                children: [
                    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "MUSEO BULAWAN", bold: true, size: 36 })] }),
                    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "COLLECTION MANAGEMENT SYSTEM", size: 20 })] }),
                    new Paragraph({ break: 1 }),
                    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "INVENTORY STATUS REPORT", bold: true, size: 28 })] }),
                    new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `STATUS: ${data.status}`, bold: true, size: 20, color: "000000" })] }),
                    new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `As of ${data.lastUpdated}`, size: 16, color: "666666" })] }),
                    new Paragraph({ break: 1 }),
                    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: "I. CATALOG IDENTIFICATION", bold: true })] }),
                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        rows: [
                            new TableRow({
                                children: [
                                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Catalog Number:", bold: true }), new TextRun({ text: ` #${data.catNum}` })] })] }),
                                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Accession Reference:", bold: true }), new TextRun({ text: ` ${data.accNum}` })] })] }),
                                ],
                            }),
                            new TableRow({
                                children: [
                                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Current Location:", bold: true }), new TextRun({ text: ` ${data.location}` })] })] }),
                                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Object Name:", bold: true }), new TextRun({ text: ` ${data.itemName}` })] })] }),
                                ],
                            }),
                        ],
                    }),
                    new Paragraph({ break: 1 }),
                    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: "II. SPECIFICATION", bold: true })] }),
                    new Paragraph({ children: [new TextRun({ text: "Dimensions: ", bold: true }), new TextRun({ text: data.dimensions })] }),
                    new Paragraph({ children: [new TextRun({ text: "Materials: ", bold: true }), new TextRun({ text: data.materials })] }),
                    new Paragraph({ break: 1 }),
                    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: "III. RECENT MOVEMENT LOG", bold: true })] }),
                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        rows: [
                            new TableRow({
                                children: [
                                    new TableCell({ children: [new Paragraph({ text: "Date", bold: true })] }),
                                    new TableCell({ children: [new Paragraph({ text: "Target Location", bold: true })] }),
                                    new TableCell({ children: [new Paragraph({ text: "Reason", bold: true })] }),
                                ],
                            }),
                            ...data.movement.map(m => new TableRow({
                                children: [
                                    new TableCell({ children: [new Paragraph({ text: m.date })] }),
                                    new TableCell({ children: [new Paragraph({ text: m.to })] }),
                                    new TableCell({ children: [new Paragraph({ text: m.reason })] }),
                                ],
                            })),
                        ],
                    }),
                ],
            }],
        });

        return await Packer.toBuffer(doc);
    }
};
