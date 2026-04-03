
process.env.DATABASE_URL=require('fs').readFileSync('.env.local','utf8').match(/DATABASE_URL="([^"]+)"/)[1];
const {PrismaClient}=require('./node_modules/@prisma/client');
const p=new PrismaClient();
(async()=>{
const r=await p.$queryRawUnsafe(`SELECT (SELECT COUNT(*) FROM "KolProfile") AS profiles, (SELECT COUNT(*) FROM "KolAlias") AS aliases, (SELECT COUNT(*) FROM "KolTokenLink") AS token_links, (SELECT COUNT(*) FROM information_schema.columns WHERE table_name='KolProfile' AND column_name='publishStatus') AS has_publish_status`);
console.log(JSON.stringify(r,null,2));
await p.$disconnect();
})()
