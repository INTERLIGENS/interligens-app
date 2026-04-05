
process.env.DATABASE_URL=require('fs').readFileSync('.env.local','utf8').match(/DATABASE_URL="([^"]+)"/)[1];
const {PrismaClient}=require('./node_modules/@prisma/client');
const p=new PrismaClient();
const stmts=[
`ALTER TABLE "social_post_candidates" ADD COLUMN IF NOT EXISTS "detectedTokens" TEXT NOT NULL DEFAULT '[]'`,
`ALTER TABLE "social_post_candidates" ADD COLUMN IF NOT EXISTS "detectedAddresses" TEXT NOT NULL DEFAULT '[]'`,
`ALTER TABLE "social_post_candidates" ADD COLUMN IF NOT EXISTS "signalTypes" TEXT NOT NULL DEFAULT '[]'`,
`ALTER TABLE "social_post_candidates" ADD COLUMN IF NOT EXISTS "signalScore" INTEGER NOT NULL DEFAULT 0`,
`ALTER TABLE "social_post_candidates" ADD COLUMN IF NOT EXISTS "dedupKey" TEXT`,
`ALTER TABLE "social_post_candidates" ADD COLUMN IF NOT EXISTS "profileSnapshot" TEXT`,
`CREATE UNIQUE INDEX IF NOT EXISTS "social_post_candidates_dedupKey_key" ON "social_post_candidates"("dedupKey") WHERE "dedupKey" IS NOT NULL`
];
(async()=>{
for(const s of stmts){try{await p.$executeRawUnsafe(s);console.log('OK:',s.slice(0,60))}catch(e){console.log('skip:',e.message.slice(0,60))}}
await p.$disconnect();
})()
