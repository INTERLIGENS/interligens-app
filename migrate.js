
process.env.DATABASE_URL=require('fs').readFileSync('.env.local','utf8').match(/DATABASE_URL="([^"]+)"/)[1];
const {PrismaClient}=require('./node_modules/@prisma/client');
const p=new PrismaClient();
const sql=require('fs').readFileSync('kol-seed-engine-v1.sql','utf8');
const statements=sql.split(';').map(s=>s.trim()).filter(s=>s.length>3&&s[0]!=='-');
(async()=>{for(const s of statements){try{await p.$executeRawUnsafe(s+';')}catch(e){console.log('skip:',e.message.slice(0,80))}}console.log('Migration OK');await p.$disconnect()})()
