import fs from 'fs';
import path from 'path';
import PizZip from 'pizzip';

const templates = ['DONATION-FORM.docx', 'LEND-FORM.docx'];
const templatesDir = './apps/api/src/templates';

for (const templateName of templates) {
    const filePath = path.join(templatesDir, templateName);
    if (!fs.existsSync(filePath)) {
        console.log(`Template not found: ${filePath}`);
        continue;
    }
    const content = fs.readFileSync(filePath, 'binary');
    const zip = new PizZip(content);
    const docXml = zip.file('word/document.xml').asText();
    
    // Strip XML tags
    const plainText = docXml.replace(/<[^>]+>/g, ' ');
    // Clean up spaces
    const cleanText = plainText.replace(/\s+/g, ' ').trim();
    
    console.log(`\n==========================================`);
    console.log(`TEXT FOR: ${templateName}`);
    console.log(`==========================================`);
    console.log(cleanText.substring(0, 1500)); // print first 1500 chars
    console.log(`\n... (truncated) ...\n`);
    console.log(cleanText.substring(cleanText.length - 1000)); // print last 1000 chars
}
