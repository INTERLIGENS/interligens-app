
process.env.DATABASE_URL=require('fs').readFileSync('.env.local','utf8').match(/DATABASE_URL="([^"]+)"/)[1];
const {PrismaClient}=require('./node_modules/@prisma/client');
const p=new PrismaClient();
const stmts=[
`ALTER TABLE "KolProfile" ADD COLUMN IF NOT EXISTS "publishStatus" TEXT NOT NULL DEFAULT 'draft'`,
`ALTER TABLE "KolProfile" ADD COLUMN IF NOT EXISTS "internalNote" TEXT`,
`ALTER TABLE "KolProfile" ADD COLUMN IF NOT EXISTS "walletAttributionStatus" TEXT NOT NULL DEFAULT 'none'`,
`ALTER TABLE "KolProfile" ADD COLUMN IF NOT EXISTS "evidenceStatus" TEXT NOT NULL DEFAULT 'none'`,
`ALTER TABLE "KolProfile" ADD COLUMN IF NOT EXISTS "proceedsStatus" TEXT NOT NULL DEFAULT 'none'`,
`ALTER TABLE "KolProfile" ADD COLUMN IF NOT EXISTS "editorialStatus" TEXT NOT NULL DEFAULT 'pending'`,
`UPDATE "KolProfile" SET "publishStatus"='published' WHERE "publishable"=true AND "publishStatus"='draft'`,
`ALTER TABLE "KolWallet" ADD COLUMN IF NOT EXISTS "confidence" TEXT NOT NULL DEFAULT 'medium'`,
`ALTER TABLE "KolWallet" ADD COLUMN IF NOT EXISTS "attributionSource" TEXT`,
`ALTER TABLE "KolWallet" ADD COLUMN IF NOT EXISTS "attributionNote" TEXT`,
`ALTER TABLE "KolEvidence" ADD COLUMN IF NOT EXISTS "dedupKey" TEXT`,
`CREATE TABLE IF NOT EXISTS "KolAlias" ("id" TEXT NOT NULL DEFAULT gen_random_uuid(), "kolHandle" TEXT NOT NULL, "alias" TEXT NOT NULL, "type" TEXT NOT NULL DEFAULT 'secondary', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "KolAlias_pkey" PRIMARY KEY ("id"), CONSTRAINT "KolAlias_kolHandle_fkey" FOREIGN KEY ("kolHandle") REFERENCES "KolProfile"("handle") ON DELETE CASCADE ON UPDATE CASCADE)`,
`CREATE UNIQUE INDEX IF NOT EXISTS "KolAlias_kolHandle_alias_key" ON "KolAlias"("kolHandle","alias")`,
`CREATE INDEX IF NOT EXISTS "KolAlias_alias_idx" ON "KolAlias"("alias")`,
`CREATE TABLE IF NOT EXISTS "KolTokenLink" ("id" TEXT NOT NULL DEFAULT gen_random_uuid(), "kolHandle" TEXT NOT NULL, "contractAddress" TEXT NOT NULL, "chain" TEXT NOT NULL, "tokenSymbol" TEXT, "role" TEXT NOT NULL DEFAULT 'promoter', "note" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "KolTokenLink_pkey" PRIMARY KEY ("id"), CONSTRAINT "KolTokenLink_kolHandle_fkey" FOREIGN KEY ("kolHandle") REFERENCES "KolProfile"("handle") ON DELETE CASCADE ON UPDATE CASCADE)`,
`CREATE UNIQUE INDEX IF NOT EXISTS "KolTokenLink_kolHandle_contract_chain_key" ON "KolTokenLink"("kolHandle","contractAddress","chain")`,
`CREATE INDEX IF NOT EXISTS "KolTokenLink_kolHandle_idx" ON "KolTokenLink"("kolHandle")`,
`CREATE INDEX IF NOT EXISTS "KolProfile_publishStatus_idx" ON "KolProfile"("publishStatus")`,
`CREATE INDEX IF NOT EXISTS "KolProfile_editorialStatus_idx" ON "KolProfile"("editorialStatus")`,
`CREATE INDEX IF NOT EXISTS "KolWallet_confidence_idx" ON "KolWallet"("confidence")`
];
(async()=>{
for(const s of stmts){
  try{await p.$executeRawUnsafe(s);console.log('OK:',s.slice(0,60))}
  catch(e){console.log('skip:',s.slice(0,40),'=>',e.message.slice(0,60))}
}
const r=await p.$queryRawUnsafe('SELECT (SELECT COUNT(*) FROM "KolProfile") AS profiles,(SELECT COUNT(*) FROM "KolAlias") AS aliases,(SELECT COUNT(*) FROM "KolTokenLink") AS token_links');
console.log('CHECK:',JSON.stringify(r));
await p.$disconnect();
})()
