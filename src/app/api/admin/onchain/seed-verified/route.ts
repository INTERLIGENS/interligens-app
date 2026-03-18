/**
 * src/app/api/admin/onchain/seed-verified/route.ts
 * Importe les 98 wallets vérifiés depuis le CSV
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/security/adminAuth";
import { prisma } from "@/lib/prisma";

// Données statiques — les 98 adresses vérifiées
// (extrait de INTERLIGENS_wallets_VERIFIED.csv)
const VERIFIED_WALLETS = [
  { handle: "@VitalikButerin", ens: "vitalik.eth", address: "0xd8da6bf26964af9d7eed9e03e53415d37aa96045" },
  { handle: "@sassal0x", ens: "sassal.eth", address: "0x648aa14e4424e0825a5ce739c8c68610e143fb79" },
  { handle: "@balajis", ens: "balajis.eth", address: "0x0916c04994849c676ab2667ce5bbdf7ccc94310a" },
  { handle: "@LefterisJP", ens: "lefteris.eth", address: "0x2b888954421b424c5d3d9ce9bb67c9bd47537d12" },
  { handle: "@PopPunkOnChain", ens: "poppunk.eth", address: "0x9884879e5f36e8c901900303b075c2fc175ea0f4" },
  { handle: "@zacxbt", ens: "zachxbt.eth", address: "0x9d727911b54c455b0071a7b682fcf4bc444b5596" },
  { handle: "@blknoiz06", ens: "blknoiz.eth", address: "0x03a101901bafa5d179ada227b3fc2c3cec4ce000" },
  { handle: "@andyyy", ens: "andy8052.eth", address: "0x90e5aa59a9df2add394df81521dbbed5f3c4a1a3" },
  { handle: "@danheld", ens: "danheld.eth", address: "0x7616e594f1832d0dc7aad3923967d76fd98416e2" },
  { handle: "@ethereumJoseph", ens: "lubin.eth", address: "0x3ace674a79c0488b00db7928be3364e7aa443692" },
  { handle: "@IvanOnTech", ens: "ivanontech.eth", address: "0x5f75da57bd7eebbbc8e32f9158842d1f36de6775" },
  { handle: "@serpinxbt", ens: "serpin.eth", address: "0x52ac12480565555257a77c9f79f5b7ac770cfa09" },
  { handle: "@Loxley_eth", ens: "loxley.eth", address: "0x848172585cf38aad29c6b8244dbdd604af4cf05d" },
  { handle: "@themansion_eth", ens: "themansion.eth", address: "0x42c408baa4d486477d22b7823b77cd911f89b733" },
  { handle: "@Punk9277", ens: "punk9277.eth", address: "0xd955f0cac6ce897cfaf07ec953a79570a97e732d" },
  { handle: "@0xFastLife", ens: "fastlife.eth", address: "0x3a1df38c88a5f4ae0a346099c9c25bf5cd8b4dbe" },
  { handle: "@tylerdurdeth", ens: "tylerdurdeth.eth", address: "0xd2b12f1a75b2313980d7c410002e6a48cf389b8d" },
  { handle: "@0xFrisk", ens: "frisk.eth", address: "0xb369e9c4f23a8c1a9e7aa83456616a5b367e0c3a" },
  { handle: "@Carlitoswa_y", ens: "carlitosway.eth", address: "0x6a3867484b29744c6d01b9040a0515711828deb0" },
  { handle: "@0x_ultra", ens: "ultra.eth", address: "0x552b6ad871f27a9729162c18d769050363f2d57e" },
  { handle: "@0x_Abdul", ens: "0xabdul.eth", address: "0x643f2143f78102bb8663f7b9483076a8f091b88b" },
  { handle: "@0xGrimjow", ens: "grimjow.eth", address: "0x940a0a8362d7b0427a8fdf9e24fbb412baa9b22c" },
  { handle: "@zayn4pf", ens: "zayn4pf.eth", address: "0xfbd982002c76a434856e5ae9aac285c1bd673362" },
  { handle: "@zjbrenner", ens: "brennen.eth", address: "0x2666f0c8fb58d182f2dd79475dca4a07b3724607" },
  { handle: "@camolNFT", ens: "camol.eth", address: "0xcb2940837b919e86899d62c19242fa49d3821f47" },
  { handle: "@nikokampouris", ens: "nickmura.eth", address: "0x4ae87a25b78fe0b7d6a9a37aad75bc3f01c61094" },
  { handle: "@cryptoleon_xyz", ens: "cryptoleon.eth", address: "0xf3dc6409306ac31eaa54c4ea120ce23d827895f0" },
  { handle: "@knowerofmarkets", ens: "knower.eth", address: "0x61a71d6787965df638f9f7f1af9566c91b5c7637" },
  { handle: "@banditxbt", ens: "bandit.eth", address: "0x7b3431db5a984c7a7a710175f6119a385070e9ec" },
  { handle: "@MLeeJr", ens: "mleejr.eth", address: "0xadd72e24a9e9117aa16d253cb421cb93b00240e3" },
  { handle: "@happysubstack", ens: "happy.eth", address: "0x5154dceeadd948111678616de0394a4544e3abe4" },
  { handle: "@AzFlin", ens: "azflin.eth", address: "0x9ff1313eeb6dc67a083449fd12a259ec9d766bd2" },
  { handle: "@lorden_eth", ens: "lorden.eth", address: "0xa847fd08c99d79a2c5c3729a11b1e4bf855fc7ff" },
  { handle: "@0xAndrewMoh", ens: "andrewmoh.eth", address: "0x216a259d147d065197a783ceb45ec4b93114a707" },
  { handle: "@eli5_defi", ens: "eli5defi.eth", address: "0xd16e596d6f9556e0fc79a15dd26c22349912b4da" },
  { handle: "@0x_Todd", ens: "0xtodd.eth", address: "0x17f3f81860345567482e1d232fb5b6f8bd77f3bd" },
  { handle: "@reisnertobias", ens: "reisner.eth", address: "0x5cd4757d6ff4ea31feaa98df1f3b388a809f733f" },
  { handle: "@Nomaticcap", ens: "nomatic.eth", address: "0xc56399a8775eae18de28f20698ef3bf4f3275a65" },
  { handle: "@Jonasoeth", ens: "jonas.eth", address: "0x9f49230672c52a2b958f253134bb17ac84d30833" },
  { handle: "@NamikMuduroglu", ens: "namik.eth", address: "0x8217cc277a8edfda132a0123761e1d2aa795ecc6" },
  { handle: "@PixOnChain", ens: "pixonchain.eth", address: "0x628ea111406a68f4ec00ca3587843ef0058ba6f3" },
  { handle: "@icobeast", ens: "icobeast.eth", address: "0x287bdf8c332d44bb015f8b4deb6513010c951f39" },
  { handle: "@ripchillpill", ens: "chillpill.eth", address: "0xbf1e8d8efe9cda7eb03b4ca5f67135831169b385" },
  { handle: "@NTmoney", ens: "ntmoney.eth", address: "0xb511cd8f541c8beeb66a28b1aedf3ef7756ab79d" },
  { handle: "@beijingdou", ens: "beijingdou.eth", address: "0xaf469c4a0914938e6149cf621c54fb4b1ec0c202" },
  { handle: "@HugoMartingale", ens: "hugo.eth", address: "0x85ff87f383c42e150dd2058195de698512a591df" },
  { handle: "@notthreadguy", ens: "threadguy.eth", address: "0x29274beb531b2af6cea35aa04c5e36dcb174a411" },
  { handle: "@TimHaldorsson", ens: "timh.eth", address: "0xf9b0665b81fceea947f5117fe05fdc4f4ce1427b" },
  { handle: "@Deebs_DeFi", ens: "deebs.eth", address: "0xdf80e4a1e49bcac4a3a02b7536a531258dba2bba" },
  { handle: "@KierianV", ens: "kierian.eth", address: "0x3b68b541af74a55c5af69c07ba5072317a4a3288" },
  { handle: "@0xNairolf", ens: "nairolf.eth", address: "0x481f50a5bdccc0bc4322c4dca04301433ded50f0" },
  { handle: "@Web3Adam", ens: "web3adam.eth", address: "0xfce4f75254f2f06d669b48e19fce19e5d0435c39" },
  { handle: "@KyleDeWriter", ens: "kyle.eth", address: "0x205389a3a0ba0928f9c696fb29cbb3edc66183be" },
  { handle: "@GianTheRios", ens: "gian.eth", address: "0xfec8054a38e78627d44144f325ae701dd51065cc" },
  { handle: "@internbrah", ens: "intern.eth", address: "0x84133b011fe4ed6c7e5008ffc786f6626069df4b" },
  { handle: "@0xWenMoon", ens: "0xwenmoon.eth", address: "0x051c21d7c363285034a3b0ec1ae477dcdfce3447" },
  { handle: "@ashen_one", ens: "ashenone.eth", address: "0xc18cf3fce9d397d9094c34a94b8dc668212b7c08" },
  { handle: "@immortalhowwl", ens: "howl.eth", address: "0xa326db2aedd2e20bb120ed61ac281b8baa7e24ab" },
  { handle: "@0xdahua", ens: "dahua.eth", address: "0x6a878e7b885def1cc8cbd7a1f8d3d58a938dc04d" },
  { handle: "@aaalexhl", ens: "aaalex.eth", address: "0xa9d508815d1216914706c03c566dc20dd972b383" },
  { handle: "@greenytrades", ens: "greeny.eth", address: "0x3972352d41ebe283dba719d65db5c846e408dd02" },
  { handle: "@jamweb3_", ens: "jamweb3.eth", address: "0xba9db4d7b1817f46b1fc1bd90e1a6e23b3c98b0d" },
  { handle: "@DemonTime", ens: "demontime.eth", address: "0x908b6ee32c31eeb530514bf950e57277b689fb0b" },
  { handle: "@0xxNathan", ens: "nathan.eth", address: "0xbb463d23c580ba6527186e18edec74786a273247" },
  { handle: "@HOSS_ibc", ens: "hoss.eth", address: "0x700e9dacbcb04f33d01164977c129b156877cb30" },
  { handle: "@MookieNFT", ens: "mookie.eth", address: "0x064c91fc201915d38b05e73d5272ad8986d05920" },
  { handle: "@youfadedwealth", ens: "fadedwealth.eth", address: "0x803de226d9cc88e2f60907cbb92e77dda2953033" },
  { handle: "@Smokey_", ens: "smokey.eth", address: "0x807a9fa3cedec27cf5bdf4bd093fc2a92fc7be79" },
  { handle: "@Jeremybtc", ens: "jeremy.eth", address: "0x1f01d99a90ad0c752e7765de29c386a169bd9e37" },
  { handle: "@0xSweep", ens: "0xsweep.eth", address: "0x4bab4d8fb2abff78f2cb29178e612e4d463a45c8" },
  { handle: "@AshleyDCan", ens: "ashleydcan.eth", address: "0x32952286fad2caa5bc9ae65f4c901e1e85d21e93" },
  { handle: "@MattInWeb3", ens: "mattinweb3.eth", address: "0xc68d994c192e1fcdcf281f9579c3337d9b618775" },
  { handle: "@Hydraze420", ens: "hydraze.eth", address: "0x2a93e999816c9826ade0b51aaa2d83240d8f4596" },
  { handle: "@Langerius", ens: "langer.eth", address: "0x0c0980fc3a0e86b7d7d0adc3389071a01e0b28fa" },
  { handle: "@mhkNFTs", ens: "mhk.eth", address: "0x094b283e093b03a3058f663c15cb26f2c81aedca" },
  { handle: "@RealmissNFT", ens: "missnft.eth", address: "0x4e8ed6b5f603ab93478baf9c5be961528246a627" },
  { handle: "@buntyverse", ens: "bunty.eth", address: "0x5f93bba7fcd8255671c3e13cbf9064e8a353fbe4" },
  { handle: "@wabdoteth", ens: "wab.eth", address: "0x741047ae552e58e89f1ff51d9a06e5d9dfba3feb" },
  { handle: "@thetinaverse", ens: "tina.eth", address: "0x83a90893f6ca071041f9967a9c001a8ca28cd0fe" },
  { handle: "@CryptoUsopp", ens: "usopp.eth", address: "0x00333d7f0ffc5564f9898f56efad1dd4818deefe" },
  { handle: "@rektmando", ens: "rektmando.eth", address: "0xdb5cea9724febf904743b50d23511a466994e44e" },
  { handle: "@Nibel_eth", ens: "nibel.eth", address: "0xc2ca7c647c7959f14700d8fd5b6219b44ca56930" },
  { handle: "@ProofOfTravis", ens: "travis.eth", address: "0x93abc512ba22614df66e6623bbb8e2aaf2fcda1b" },
  { handle: "@Tuteth_", ens: "tut.eth", address: "0xddd3964d75d59b6b6d5c31eb313bba5ebf076364" },
  { handle: "@0xHeisenbruh", ens: "heisenbruh.eth", address: "0xe9a4a9e8302dadcb577d5c6267d246b17070480b" },
  { handle: "@player1", ens: "player1.eth", address: "0xceb7d613cd04231371c79b9893169c4e8cf658b1" },
  { handle: "@goon_crypto", ens: "goon.eth", address: "0xcbb2534c6898655d50fdac79d6e4b23b18a25b97" },
  { handle: "@tarunchitra", ens: "tarun.eth", address: "0x0bd3002e0ce2a000deb3da519d15061366412830" },
  { handle: "@iamfakeguru", ens: "fakeguru.eth", address: "0x7c31c35361c938733f9f35faa434b57042d4149a" },
  { handle: "@PaulRBerg", ens: "paulrberg.eth", address: "0xdb69537109999c0255cd431cecfa31ed807b5072" },
  { handle: "@poopmandefi", ens: "poopman.eth", address: "0x3c5b0267435616325c8620e9321e99787dafc7d3" },
  { handle: "@Param_eth", ens: "param.eth", address: "0x806d6793befa958c8e2d2a364c072c250e110cfe" },
  { handle: "@S4mmyEth", ens: "s4mmy.eth", address: "0x87c3298bbf72ee60bdff2e48dbd757199e970db8" },
  { handle: "@thegaboeth", ens: "gabo.eth", address: "0x4812a4226cf3850b966e5a0265f4ab68ad45cc95" },
  { handle: "@LucaNetz", ens: "lucanetz.eth", address: "0x3f8cd3cc58391e704a2a0fab2482b8116cb9d670" },
  { handle: "@walsxbt", ens: "wals.eth", address: "0x42fe01a213a6588d7958e3bfda09a08b58cbbbd2" },
  { handle: "@Jampzey", ens: "jampzey.eth", address: "0xa25745ada04468a397b485690568ae0c4c201f6d" },
  { handle: "@SkylineETH", ens: "skyline.eth", address: "0x50a1da25bf9e93e5f0eefbeba0db8dda160222a4" },
];

export async function POST(req: NextRequest) {
  const deny = requireAdminApi(req);
  if (deny) return deny;

  let created = 0;
  let skipped = 0;

  for (const w of VERIFIED_WALLETS) {
    const influencer = await prisma.influencer.upsert({
      where: { handle: w.handle },
      create: { handle: w.handle, platform: "x" },
      update: {},
    });

    const existing = await prisma.wallet.findUnique({
      where: { address_chain: { address: w.address.toLowerCase(), chain: "ethereum" } },
    });

    if (!existing) {
      await prisma.wallet.create({
        data: {
          address: w.address.toLowerCase(),
          chain: "ethereum",
          influencerId: influencer.id,
          verifiedMethod: "ENS_ONCHAIN",
          verifiedAt: new Date(),
          confidence: 1.0,
          ensName: w.ens,
        },
      });
      created++;
    } else {
      skipped++;
    }
  }

  return NextResponse.json({
    total: VERIFIED_WALLETS.length,
    created,
    skipped,
  });
}
