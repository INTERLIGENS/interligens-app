// scripts/seed/run.ts
import { runSeedBatch } from './engine'
import { batch01 } from './data/batch-01'

// Pour ajouter un batch : importer et concaténer ici
// import { batch02 } from './data/batch-02'

runSeedBatch([
  ...batch01,
  // ...batch02,
]).catch((err) => {
  console.error('❌ Seed engine fatal:', err)
  process.exit(1)
})
