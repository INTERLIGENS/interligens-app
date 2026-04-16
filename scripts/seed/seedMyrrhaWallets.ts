/**
 * scripts/seed/seedMyrrhaWallets.ts
 *
 * Seed all Myrrha MM wallets from the leaked BOTIFY document.
 * 64 numbered sub-wallets + 29 core MM wallets = 93 total.
 *
 * Usage: set -a && source .env.local && set +a && npx tsx scripts/seed/seedMyrrhaWallets.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const NUMBERED: Array<[string, string]> = [
  ["8.5", "6wXq3RCfeUzzJBNqPt8rt496sCTBaFffJ1vvkY92nBdt"],
  ["9.5", "HfZGFkMZmPbWeTJ6yYBDL3347APLHk6USwd8fcizKesj"],
  ["18.5", "E1JmgZhwGWMF6XcsriqBbHDidk2aR3bocfZSbQYPYEHz"],
  ["19.5", "FJE9mTvt3PEVpsmhukMD7vchF9huQtyAt8WjAtTu8B2c"],
  ["20.5", "2kajH8Lnw9RNoG5CqvpQYjK75k2Bz3sDHfRXoBHWmB8p"],
  ["21.5", "4Aky3WGZjMTNHQMg53vfztc4ZseV4h11tRetY3qmpHjQ"],
  ["22.5", "7Gzf4XsZYFUAszvJDwuWKbLF46zSPuXoP3Y8Jm1wt1b3"],
  ["23.5", "8tDYXYSHMNHDn1PRceFy46psA3MVTSrT1cjF7bqoJysD"],
  ["24.5", "9yBmwJEqzxMgUdPYTgt7zvSdymcwfW6KsnEnZwog3Pct"],
  ["25.5", "SMP37mdhWWSxUTzALxD2wNxA1G8UUsXzUmNsFQkg2VQ"],
  ["26.5", "3cb4Hf4vAfnxSvfbN3oUhZdgM2kSKm4hX52vhkY692cc"],
  ["27.5", "8B89TpHaL6poNBuJRUBGNtoMtFB2rGnHoaMR4GbXGo7A"],
  ["28.5", "GRNLNCz5prFwM7BZRGuZv28HLX9TgVpneTnRXN9t5GsH"],
  ["29", "NDGaPDktUfhfL1MTxhpLuRMbGX1AGCYu59WMn4RNcRK"],
  ["29.5", "95HGXQtUC2TwS9x7KXS5zp4hiLwQDeVRs58XeveK29cr"],
  ["30", "6xqfGdw7Ag5EeBmY63BH2GiXJAudv8wFEPVnh8sZLTYd"],
  ["30.5", "29ekfeXRVSeT5MGa3Ax7xBW9oX2x9kUHJpys4kYVPATH"],
  ["31", "ASVhBLzEkd3Ajui9EEPM9fbDBWkYW2ac2x72n3pTbSeK"],
  ["31.5", "AtWah4JP5tZDPQeLfs9J2bpWiamBRCc6VmyquG5MPfyT"],
  ["32", "HWQdTLUwAcxeyWZ3wDWkMLAfaFxED9jtd6LzpViQMywX"],
  ["32.5", "2gn8NQqzTXs8zSkdUbEWUbaGEVhQHrMDrU8HmjbXjTWC"],
  ["33", "DKNCWQW7nJ24NKZMJx67AWBTJTzZY3yBxJXj8prtDDUx"],
  ["33.5", "Heopcs686HhuH3hxRLC79mWNR3HL7ULQMReGwGwF1TCy"],
  ["34", "BbNV8QX7AhFCmndae3LuBuCSMYJ1rQ4HUh4UystwCXiu"],
  ["34.5", "2JTaUNKZin6HazuKgCFam8cJQx9g7rcb2e7WRVRvQC8y"],
  ["35", "3aYcWUBP6UX1VWNPDRyQRoHmzPGJZQt4Ur15ri6JxoZN"],
  ["35.5", "FkzEKnMNgkBNpx3ugQhf7xUHLJG64Y1GpV4ENrzx9gVL"],
  ["36", "B5xsiXD2HEnJXFcK8ZJD3ZeLc5kP5nGXAXz1y15V6iFs"],
  ["36.5", "C5Xi4QbfUnj31J5b5zekU2gR4nHHnFeTDL6qPyYFsCps"],
  ["37", "G2LVxRe5qRFBb7XZLUUFTKsvDBbBJvANJiSK3cSauTFE"],
  ["37.5", "FmhdTUGUvY5dmMxHgLxw8YTe37egKbJscXjg4s15QmFW"],
  ["38", "9Au1zdZkPFQGYSE2k3taVQ4Cxh1YxnE1XQocbu9sbhLQ"],
  ["38.5", "5PzM1NgbrVasst4zGxeruGBPe5CY5RScP9XafWPRUWu"],
  ["39", "8aeHTNwsjmCMXUtengA8iZdmWdqGf16VPgPmKVo5Dg39"],
  ["39.5", "BrhCgTfBeJY8pVrPCVaVr3eDxc34CuygYitbXikN3EgQ"],
  ["40", "B54LDQKUMnuzYydMLZfWxJTKh4wAYfMGBkgBKPCVVLj9"],
  ["40.5", "BM7sFiRJ6vR2kCLhK4ezb2wzjvMiiV8eM1xFsc7QhQfu"],
  ["41", "2MvCtYbU6AQdD1QHeVPbJsjSiEM68qybqK8iZvQP8AMQ"],
  ["41.5", "AaoupES2XSkq9L8cnS9SbUmePCfqLW96K2bMYjUyJk6k"],
  ["42", "Gha2gHQks66j9jXtVgSiR7SWY3n4EzgCTzprFxd7GPzQ"],
  ["42.5", "E8K8kvZdoZEqvbnmMoSBh4vd5xbJmyNa2tYgwYT9f6xn"],
  ["43", "9sn6ZNoKjDb2QxhgS4F8wbEAW53DbFUpwfYfU4xxteZd"],
  ["43.5", "wbFy5Ti1gFQtPv1eAVN2TV6W9T2PZ15UxDR5HvxzNvD"],
  ["44", "BkuupFDrtA5fNtoWoNRg7hC1BuJmRc2Y4z86geUC3tph"],
  ["44.5", "Cp8qFuk9X5kh8xbSDAjrVkhUSp8wRTbFDi8TRtotDt6o"],
  ["45", "3GbcYKGN8NrkrRXaJAmUzGcmwbrbAxjGvFsKgvGqshRa"],
  ["45.5", "HV38eAGvDiPFLT7PZU5FddFHpXxXm2yUeT4dbwk4WdxK"],
  ["46", "3ga96566hvfQ9EyFBvcki9fFRsPbpk5bGZKqo9Vf5KKb"],
  ["46.5", "5ocjCydNxcTYgRGhmcLQTboADAxet7iWUfHHm1inWwCP"],
  ["47", "AfrFK9LpjXv7F6Tduxw8k7Ctq9xW7Cf7iwcKDyTkpePx"],
  ["47.5", "5FvHr6auxzEaRyb8BLau9Z2ewDXHcpDXqshbejdeZwTN"],
  ["48", "39aZ7uzMjmZSfGNuVLSgY44V2Lt9AG5HEWkDzApi9LG1"],
  ["48.5", "8qD1hRmUNoK6W8mmeWQESKEDc4oTEJA92wtJJf7dp1xn"],
  ["49", "FkKiN8BcKKRULDqMn14VNUdaPKMSMvvUjUiTsjjiRfXN"],
  ["50", "61opnBgWk8SyLEXbXGwc6mAnCwGbmFBXGkFYF5mBrjfV"],
  ["51", "BREqyPV8x7qsyaSWbK7h2SKgsDobqfQPu143q6cKsVi5"],
  ["51.5", "EjZ6HerNTiKuLokuFXYSJCYgjsMuvRmVqKAQhnvj8K2q"],
  ["52", "5M3Geoz1jwZJABrRAyho4FHtz4C2F7XBiM9dbGaBXH3W"],
  ["52.5", "J11Hxe1ddy5ytk7WFYympzbUM9Da9U2ks6Nv8XLFecQc"],
  ["53", "HgtPaB9euTBaGFPAZd6XabaLYZ5apCX5ZNbizWBx2ghz"],
  ["53.5", "Aiaw349ndztKhJrbP5ZPHdpNFGQnWbv8b4jEuHNDgy5c"],
  ["55", "6Exqz2QhYpDDn6cneibNpf8v6Qx8ZjGeZ77ezAbkw9ts"],
  ["55.5", "FnV1En2GaoFYqKZTbADyGnpjBXRSXrxKRK98cAJFoqpp"],
  ["56", "CZ2ab6UPVBNe3F7iTe7dsbR4JhrcV4XKmczY5MtjDo4e"],
  ["57", "54tuhSTTPQTaqbYBtpDas2prRo2wMP5FaSAmam8rgF2e"],
  ["57.5", "GXZher2kE2irgP8xMgJfgqx99MSu7DBttTmq4biWXmg"],
  ["58", "EdhfdaN2KFvDYtuNcwD2QTZcry4YuSwTjSugkhrFaRUj"],
  ["58.5", "9i1n8dFGiwTa72BPDbzmjXWxxHMyaooy4LSHGDwNwoK3"],
  ["59", "XzngXiEqbKo4Kv1JpTnZBzudeP5kuk1kYEd6oT8WPCn"],
  ["59.5", "sDAbiUjdFKy1eQ2MLfEKXKrE6o5PEUgQy6whSNNqF2a"],
  ["60", "Hrq99joE9X5nB82baVdBx35q9w5kwnvViqahnPdumkxp"],
  ["60.5", "nCHN6zXBK8bdAi1raYEyLmQd8LboDJH2SZak3q7WvvS"],
  ["61", "AKFKWkbptjSNemxdM8xHcMYatu8UEtQnsVy5ewSXKWPB"],
  ["61.5", "GBQsZERmcmsPipfFGNxXBFYF7brgHDQPP3VAAopPrwkv"],
  ["64", "2HTtD7HF5PUbyMXZ3x7k5GnriGDqG6vgDKY5DkVvpU71"],
  ["64.5", "6RuaJj56r1Yuwtknru7xthBLVSrSJ3B6TPcrjRHD3dP"],
  ["65", "GWZHmZsT5dEcjRC69VpNgQqcj2qTnfRRkdNusSc9P499"],
  ["65.5", "5GusZhPuZMcDHxbcbR3mPVCdCBxqnokMAYfN32MAMbze"],
  ["67", "8bsoSycvtzzJN9fgqogeZTwCB1sPEqQh2NZfpQF3SU5Q"],
  ["68", "DEW6TR2LkVYKN4zshKUs7JRadAYF4NY2GBKvFPVXZZsB"],
  ["68.5", "9GFw3Su795sAT94SYaj5VEjnQ8XeCpKfKWZmrN4i8f2d"],
  ["69", "4byPBHg3eo4qxmA7opQeCvXdFfEuxesx2HakCgtGgD2p"],
  ["69.5", "EMK53NXhRQqmCpddZtPS4gEdJNiG9FKJeiyncD98yUgo"],
];

const MM_CORE: string[] = [
  "DK6eq4VxdNrutucM7RJBkaBqRPzhvzHiZAZnkMGUyapi",
  "9YXeTfDY1KEXu937PyubMTEpJThCCLQbYPMoSFppdWXp",
  "BZNSuGFpAA4RE1LC3TQcQvQ4L8JxvVgCWfU9sCaJFnsr",
  "DjT4rqSzjh6wbxUiWxwscVEfryHCJ1uoK1M3buZhNC9F",
  "8jPr96VoC1nAjgo1dheXqAq6haUc174vBmZgJAVC3ysB",
  "6SKtmfT76CaZ66DkMMheqAa6CGwwqLv1nympGNNd3gyH",
  "GTi5X9XeSsNStNJhiGuoadj6p9cGiUDCJpzrDr4hZ7GX",
  "GDk2PkCZ4GD2V7rSjnnQDiUYTyxXSk5EYU5bpXtBfoHV",
  "3QusXiwfjuWv1RpQ3g58KJ1dbP1t2rrYPXkWf8oYdLbZ",
  "9Yuq5BFaiAuGUNEJEWuYYeZSDL8F15URTv2PsQwcLB4n",
  "47GhmJPzfq8bNKkuY4qXMKcQKoQ1Mehis1jXjZafUZ6c",
  "DzqjPH2TyihXqu4scNZ6oULYnkxhT3trvfLZyJHbSZWx",
  "5Gykg7Uu1cQiYNSZhAMnAwxFvyBjd7tYMdQEk9z4qa8R",
  "EGagqUmqdNXzggXdJT5rs3qZqoGbMwZEo6ZbKGGpVUwT",
  "Borh8sQVnHq6sxdHZiRYHQsy7UizXagvhqhTgLpy8rPF",
  "7wLN3aw4F2YN5jXQkkTSScJc8A4NmmuvaFmVnddraSos",
  "FpqZfT6oG28x237CBP6ekr1duJkH21JRpULW7krHAxi9",
  "EG2h4HjkQMm1CC1cckzryG6mkcoGYQj5qmDc7Espqzy3",
  "AheoymA9GHTfFKxb8fYLsXa6vr22UVSfYcuuGe71jQwv",
  "4JhBFjZiWhuqWZioNYZqfYS1hm4P3H5MUMEQ1Uc78KEg",
  "4xCJXTtUaMfK2smedA7it1SKcXTRKkHK9b5c9LbKrc4A",
  "3ARXzsgifDXYtMbEKDyj7GCSRSCDurg9sTEwgzHdvAyG",
  "8RUQEDhbPsxMr3qJY8RpLay5FaVgu8TMeGFvSXi1uj9",
  "4Js1bbQRkgR3Vi49pvkLxHPj31gRC69aZcF2tjyMetWo",
  "7g3HWxXvFwMsYRnCfCMe8hCgFoY45nK9N69j3i7i6oFT",
  "22U3ddTCS1e7YyFJAUisZ1idMVP4fu8jLqYedhXefe5x",
  "kCFxGzs6YSPq65s94fUqmaNqDrWx3VsWHJ23ZWJTsW9",
  "3Gr4mYrBppm2BPxCTKPyxaMqcYPLuMPEC2qQYdEVe1Ej",
  "ET6Cc4qwo85nCsxCURZ3B9qPqCoAPp1EC7tndFyjPr8n",
];

async function main() {
  let created = 0;
  let skipped = 0;

  console.log(`=== Myrrha MM numbered wallets: ${NUMBERED.length} ===`);
  for (const [num, addr] of NUMBERED) {
    const exists = await prisma.kolWallet.findFirst({ where: { kolHandle: "Myrrha", address: addr } });
    if (exists) { skipped++; continue; }
    await prisma.kolWallet.create({
      data: {
        kolHandle: "Myrrha",
        address: addr,
        chain: "SOL",
        label: `MM sub-wallet #${num} — wash trading cluster BOTIFY`,
        attributionSource: "botify_leaked_doc",
        attributionStatus: "confirmed",
        isPubliclyUsable: true,
        confidence: "high",
      },
    });
    created++;
  }
  console.log(`  Created: ${created}, Skipped: ${skipped}`);

  const prevCreated = created;
  console.log(`\n=== Myrrha MM core wallets: ${MM_CORE.length} ===`);
  for (const addr of MM_CORE) {
    const exists = await prisma.kolWallet.findFirst({ where: { kolHandle: "Myrrha", address: addr } });
    if (exists) { skipped++; continue; }
    await prisma.kolWallet.create({
      data: {
        kolHandle: "Myrrha",
        address: addr,
        chain: "SOL",
        label: "MM Myrrha core wallet — wash trading BOTIFY",
        attributionSource: "botify_leaked_doc",
        attributionStatus: "confirmed",
        isPubliclyUsable: true,
        confidence: "high",
      },
    });
    created++;
  }
  console.log(`  Created: ${created - prevCreated}, Skipped: ${skipped}`);

  console.log(`\n=== TOTAL ===`);
  console.log(`Wallets created: ${created}`);
  console.log(`Wallets skipped (already exist): ${skipped}`);
  console.log(`Total Myrrha wallets in input: ${NUMBERED.length + MM_CORE.length + 1} (incl. main)`);

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
