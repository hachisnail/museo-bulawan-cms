import { db } from '../src/config/db.js';

function serialize(obj) {
    return JSON.stringify(obj, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value, 2
    );
}

async function checkMedia() {
    try {
        const links = await db.query('SELECT * FROM media_links');
        console.log('Media Links:', serialize(links));
        
        const metadata = await db.query('SELECT * FROM media_metadata');
        console.log('Media Metadata:', serialize(metadata));

        const submissions = await db.query('SELECT * FROM form_submissions');
        console.log('Submissions:', serialize(submissions));

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

checkMedia();
