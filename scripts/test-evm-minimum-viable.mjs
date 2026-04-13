// Standalone test — calls getEvmAccountInfo + engine directly without
// spinning up the Next.js server. Reproduces the /api/scan/evm logic.

import { getEvmAccountInfo, EVM_CHAINS } from "../src/lib/rpc.ts";
import { detectAddressType, detectActiveEvmChains } from "../src/lib/evm/chainDetect.ts";
import { isKnownBadEvm } from "../src/lib/entities/knownBad.ts";
import { computeTigerScoreWithIntel } from "../src/lib/tigerscore/engine.ts";

const ADDRS = [
  { name: "GordonGekko", addr: "0xa5B0eDF6B55128E0DdaE8e51aC538c3188401D41" },
  { name: "Vitalik", addr: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" },
  { name: "Uniswap V3 Factory", addr: "0x1F98431c8aD98523631AE4a59f267346ea31F984" },
];

async function testOne(name, address) {
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`TEST: ${name}`);
  console.log(`ADDR: ${address}`);
  console.log(`Type: ${detectAddressType(address)}`);

  const { activeChains, details, allRpcDown } = await detectActiveEvmChains(address);
  console.log(`Active chains: ${JSON.stringify(activeChains)}`);
  console.log(`All RPC down: ${allRpcDown}`);
  for (const c of ["ethereum", "base", "arbitrum"]) {
    const d = details[c];
    console.log(
      `  ${c}: balance=${d.balance} isContract=${d.isContract} txCount=${d.transactionCount} rpcDown=${d.rpcDown}`
    );
  }

  const knownBad = isKnownBadEvm(address);
  console.log(`Known bad: ${!!knownBad}${knownBad ? ` (${knownBad.label}, ${knownBad.category})` : ""}`);

  const isContractAny = Object.values(details).some((d) => d.isContract);
  const maxBalanceEth = Math.max(
    ...Object.values(details).map((d) => Number(d.balanceRaw / 10n ** 15n) / 1000)
  );
  const maxTxCount = Math.max(...Object.values(details).map((d) => d.transactionCount));

  const primary =
    activeChains[0] === "base" ? "BASE" : activeChains[0] === "arbitrum" ? "ARBITRUM" : "ETH";

  const tiger = await computeTigerScoreWithIntel(
    {
      chain: primary,
      deep: false,
      txCount: maxTxCount,
      evm_is_contract: isContractAny,
      evm_balance_eth: maxBalanceEth,
      evm_active_chains: activeChains,
      evm_known_bad: !!knownBad,
      evm_in_watchlist: false,
    },
    address
  );

  console.log(`TigerScore: ${tiger.finalScore} / ${tiger.finalTier}`);
  console.log(`Signals:`);
  for (const d of tiger.drivers) {
    console.log(`  - ${d.id} [${d.severity}] delta=${d.delta} — ${d.label}`);
  }
}

async function main() {
  for (const t of ADDRS) {
    try {
      await testOne(t.name, t.addr);
    } catch (err) {
      console.error(`[${t.name}] failed:`, err);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
