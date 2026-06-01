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
    
    // Let's strip all xml tags but preserve content
    const plainText = docXml.replace(/<[^>]+>/g, '');
    
    // Find all occurrences of [[...]]
    const regex = /\[\[(.*?)\]\]/g;
    let match;
    const placeholders = new Set();
    while ((match = regex.exec(plainText)) !== null) {
        placeholders.add(match[1].trim());
    }
    
    console.log(`--- Placeholders in ${templateName} ---`);
    console.log(Array.from(placeholders).sort());
}
