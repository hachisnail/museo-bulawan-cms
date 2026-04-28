import { db } from "../config/db.js"

export const testService = {
    async fetchHello() {
        try {
            const result = await db.query('SELECT * FROM test'); 
            
            return result;
            
        } catch (error) {
            throw new Error("Failed to fetch hello: " + error.message);
        }
    },
    
    async fetchHelloById(helloID) {
        return await db.query('SELECT * FROM test WHERE id = ?', [helloID]);
    },

    async createHello(message) {
        return await db.query('INSERT INTO test (testCol) VALUES (?)', [message]);
    }
};