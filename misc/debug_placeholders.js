import fs from 'fs';
import path from 'path';
import PizZip from 'pizzip';

const templates = ['DONATION-FORM.docx', 'LEND-FORM.docx'];
const templatesDir = './apps/api/src/templates';

for (const templateName of templates) {
    const filePath = path.join(templatesDir, templateName);
    if (!fs.existsSync(filePath)) {
        continue;
    }
    const content = fs.readFileSync(filePath, 'binary');
    const zip = new PizZip(content);
    const docXml = zip.file('word/document.xml').asText();
    
    // Strip XML tags to get plain text
    const plainText = docXml.replace(/<[^>]+>/g, '');
    
    console.log(`\n==========================================`);
    console.log(`Brackets in ${templateName}:`);
    console.log(`==========================================`);
    
    // Search for matches that look like brackets with any contents
    const regex = /\[\s*\[\s*(.*?)\s*\]\s*\]/g;
    let match;
    while ((match = regex.exec(plainText)) !== null) {
        console.log(`Full match: "${match[0]}", Captured: "${match[1]}"`);
    }
}
