import sharp from "sharp";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WIDTH = 1200;
const HEIGHT = 630;

const svg = `<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${WIDTH}" height="${HEIGHT}" fill="#000000"/>

  <!-- Subtle grid lines -->
  <line x1="0" y1="0" x2="0" y2="${HEIGHT}" stroke="#FF6B00" stroke-width="3" opacity="0.6"/>
  <line x1="${WIDTH}" y1="0" x2="${WIDTH}" y2="${HEIGHT}" stroke="#FF6B00" stroke-width="3" opacity="0.6"/>
  <line x1="0" y1="0" x2="${WIDTH}" y2="0" stroke="#FF6B00" stroke-width="3" opacity="0.6"/>
  <line x1="0" y1="${HEIGHT}" x2="${WIDTH}" y2="${HEIGHT}" stroke="#FF6B00" stroke-width="3" opacity="0.6"/>

  <!-- Logo: INTERLIGENS. — I in orange, rest white -->
  <text x="72" y="104" font-family="'Courier New', Courier, monospace" font-size="30" font-weight="bold" letter-spacing="3" fill="#FFFFFF"><tspan fill="#FF6B00">I</tspan>NTERLIGENS.</text>

  <!-- Separator line under logo -->
  <line x1="72" y1="120" x2="1128" y2="120" stroke="#FF6B00" stroke-width="1" opacity="0.4"/>

  <!-- Main headline line 1: CHECK YOUR in white -->
  <text x="72" y="300" font-family="'Courier New', Courier, monospace" font-size="96" font-weight="bold" letter-spacing="2" fill="#FFFFFF">CHECK YOUR</text>

  <!-- Main headline line 2: EXPOSURE. in orange -->
  <text x="72" y="420" font-family="'Courier New', Courier, monospace" font-size="96" font-weight="bold" letter-spacing="2" fill="#FF6B00">EXPOSURE.</text>

  <!-- Separator -->
  <line x1="72" y1="455" x2="1128" y2="455" stroke="#FF6B00" stroke-width="1" opacity="0.4"/>

  <!-- Subtitle in gray -->
  <text x="72" y="500" font-family="'Courier New', Courier, monospace" font-size="20" fill="#888888">Advanced forensic analysis for Solana, Ethereum, Base, Arbitrum, BSC &amp; TRON wallets.</text>

  <!-- Tag line bottom right -->
  <text x="1128" y="590" font-family="'Courier New', Courier, monospace" font-size="14" fill="#FF6B00" text-anchor="end" opacity="0.7">interligens.com</text>
</svg>`;

async function main() {
  const outputPath = path.resolve(__dirname, "../public/og-default.png");
  await sharp(Buffer.from(svg)).png().toFile(outputPath);
  console.log(`✓ OG image written to ${outputPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
