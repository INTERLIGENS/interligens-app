# AT — lot de réparation `chain`, 86 entités OFAC

**Généré le 2026-09-09T13:43:42.979Z · lecture seule · AVANT écriture.**

Ce document est le **retour arrière**. Il vit dans le dépôt parce qu'une réparation
dont le rollback tient dans `/tmp` n'est pas réversible.

## Ce qui est écrit

Colonne `chain` **seule**, de `'ethereum'` vers `NULL`, sur ces 86 identifiants.
Aucune autre colonne. Aucun DDL. Aucune suppression.

## Pourquoi NULL

`chain` répond à « quelle chaîne est **établie** ? ». Pour ces lignes : **aucune**.

- L'OFAC atteste un `currencyType`, pas une blockchain. **85** disent `USDT`,
  jeton multi-chaînes (Ethereum, TRON TRC-20, Bitcoin Omni).
- **1** ne dit **rien du tout** — prémisse plus faible que les 85 autres,
  et elle est signalée comme telle dans le tableau.
- `'ethereum'` est **falsifié**, pas seulement non prouvé : 0/86 passent
  `EVM_ADDRESS_RE`, 0/86 rendent `kind:'evm'`, 86/86 sont refusées par
  `normalizeAddress(.,'ETH')`, 0/86 par `isValidAddress(.,'ETH')`.
- **EXCLUSION ≠ ÉLECTION** : la syntaxe infirme la compatibilité Ethereum, elle
  n'élit pas TRON/Bitcoin/Solana. La cible 79/7 est révoquée.

`meta.currencyType` et la provenance restent **inchangés** : les 85 `USDT`
demeurent la preuve que l'OFAC a dit USDT, jamais qu'il a dit une chaîne.

## Valeur AVANT

Valeur unique observée sur les 86 : `ethereum`

## Retour arrière — prêt à coller

```sql
-- Rétablit exactement l'état d'avant AT partie 2.
-- Borné aux 86 identifiants. Colonne chain seule.
UPDATE intel_canonical_entities
   SET chain = 'ethereum'
 WHERE id IN (
   'cmnj0gimg008nzyd9n80hwt15',
   'cmnj0ghbg008hzyd93qe8sjxx',
   'cmnj0gi6t008lzyd956u6u8r6',
   'cmnj0ggvt008fzyd9t59u6o56',
   'cmnj0ghr4008jzyd9rnt6xo91',
   'cmnj0h2t100b7zyd9dsibjgzn',
   'cmnj0gnex0099zyd9xli8gw5h',
   'cmnj0em380001zyd9ay945iqq',
   'cmnj0emr30003zyd97trlq8ou',
   'cmnj0en6q0005zyd9fx42bjua',
   'cmnj0eo220009zyd97aaaitrx',
   'cmnj0eohq000bzyd953u6nnxy',
   'cmnj0eoxd000dzyd9sumbgkxt',
   'cmnj0enme0007zyd9k8h0w73k',
   'cmnj0n1gb001bgylu2fb56zcg',
   'cmnj0epd1000fzyd90x6qpzng',
   'cmnj0epso000hzyd9ebn46bxz',
   'cmnj0eq8c000jzyd9rng02xj8',
   'cmnj0ncou002rgyluk8iypcsn',
   'cmnj0n40u001ngyluaz240vjr',
   'cmnj0n360001jgylun7iojkc9',
   'cmnj0eqo0000lzyd96ei747sc',
   'cmnj0mt8p0009gylub27kter4',
   'cmnj0msdd0005gyluj9hcv8hf',
   'cmnj0er3o000nzyd95fvplkcf',
   'cmnj0gg0h008bzyd9o2ijvnni',
   'cmnj0erjb000pzyd9krqdluea',
   'cmnj0es1j000rzyd993b5l6im',
   'cmnj0esh7000tzyd9ax8lzhq0',
   'cmnj0esww000vzyd9i9huuiio',
   'cmnj0n03j0015gylu7rqnpzad',
   'cmnj0ets7000zzyd9pah46g35',
   'cmnj0eu7u0011zyd9qtcya13s',
   'cmnj0ev350015zyd96qrlt3uz',
   'cmnj0n2ql001hgylua78w9u7f',
   'cmnj0etcj000xzyd9aik3absz',
   'cmnj0euni0013zyd95otn4w9b',
   'cmnj0n10w0019gyluutmkfh9q',
   'cmnj0evit0017zyd9cw1g8fct',
   'cmnj0evyg0019zyd9cgom73s0',
   'cmnj0ewts001dzyd9yg0qsbb3',
   'cmnj0gemt0085zyd9v1n3vbtc',
   'cmnj0ewe4001bzyd9s8kgfmzz',
   'cmnj0ex9n001fzyd98b9moor8',
   'cmnj0expb001hzyd9pf90ra0k',
   '21979e8f-19d1-428f-be41-8cf5a3e74b7e',
   'cmnj0naga002hgylungcbeumq',
   'cmnj0ge760083zyd90auudpiw',
   'cmnj0ey50001jzyd9389gfb6k',
   'cmnj0n3lf001lgylup3gz6abe',
   'cmnj0eykn001lzyd9pne442rt',
   'cmnj0msta0007gylu3vzmrlph',
   'cmnj0ez0a001nzyd92e9xphx7',
   'cmnj0ezfx001pzyd92n60nypb',
   'cmnj0f0b7001tzyd9yi1a1g0r',
   'cmnj0f16i001xzyd9jda8fftp',
   'cmnj0ezvk001rzyd9hsfag1xm',
   'cmnj0f0qu001vzyd9cdco9w7e',
   'cmnj0n1vr001dgylu4t2ejq83',
   'cmnj0f1m7001zzyd9cx0alvhq',
   'cmnj0f21v0021zyd95a9nlztp',
   'cmnj0f2hj0023zyd9wuytxntr',
   'cmnj0f2x60025zyd92ipo3xxi',
   'cmnj0gfks0089zyd90c5fv6au',
   'cmnj0f3v30029zyd9pnkqd411',
   'cmnj0f3ct0027zyd9wglp7t5x',
   'cmnj0mzo40013gyluawom58ih',
   'cmnj0f4aq002bzyd9j7dvqdoj',
   'cmnj0f4qe002dzyd9cspomb3s',
   'cmnj0gf530087zyd9bkf0jf72',
   'cmnj0f561002fzyd9ifmxb4mo',
   'cmnj0ku0x00sdzyd9ful6rce8',
   'cmnj0n4g8001pgylunysx5dfe',
   'cmnj0f5lo002hzyd9k2lm67mf',
   'cmnj0f61b002jzyd9coywsbeb',
   'cmnj0f6gz002lzyd9f5uwso4f',
   'cmnj0n8qk0029gylukdouofze',
   'cmnj0f6wm002nzyd9bwspqyea',
   'cmnj0j62b00krzyd9p85os1z2',
   'cmnj0n2b7001fgyluki6l5k1i',
   'cmnj0n0ix0017gylubkt6z05q',
   'cmnj0f7rw002rzyd9brkuw1qb',
   'cmnj0f7c9002pzyd9suqemsgh',
   'cmnj0f87k002tzyd91e3s1k5w',
   'cmnj0f8n7002vzyd9azpma9rp',
   'cmnj0f92u002xzyd96gmyn48a'
 );
-- attendu : UPDATE 86
```

## Les 86 lignes

| # | id | valeur | avant | après | ce que l'OFAC annonce |
|---|---|---|---|---|---|
|  1 | `cmnj0gimg008nzyd9n80hwt15` | `16iWn2J1McqjToYLHSsAyS6En3QA8YQ91H` | `ethereum` | `NULL` | USDT |
|  2 | `cmnj0ghbg008hzyd93qe8sjxx` | `1CF46Rfbp97absrs7zb7dFfZS6qBXUm9EP` | `ethereum` | `NULL` | USDT |
|  3 | `cmnj0gi6t008lzyd956u6u8r6` | `1Df883c96LVauVsx9FEgnsourD8DELwCUQ` | `ethereum` | `NULL` | USDT |
|  4 | `cmnj0ggvt008fzyd9t59u6o56` | `1KUUJPkyDhamZXgpsyXqNGc3x1QPXtdhgz` | `ethereum` | `NULL` | USDT |
|  5 | `cmnj0ghr4008jzyd9rnt6xo91` | `1LrxsRd7zNuxPJcL5rttnoeJFy1y4AffYY` | `ethereum` | `NULL` | USDT |
|  6 | `cmnj0h2t100b7zyd9dsibjgzn` | `3E6ZCKRrsdPc35chA9Eftp1h3DLW18NFNV` | `ethereum` | `NULL` | USDT |
|  7 | `cmnj0gnex0099zyd9xli8gw5h` | `3LtcaPbCj87CwJHnRX3vh7c2y9RZQqeSy8` | `ethereum` | `NULL` | USDT |
|  8 | `cmnj0em380001zyd9ay945iqq` | `TA3941uFAvmVibSkQ6fMJXxmaSNovX86mz` | `ethereum` | `NULL` | USDT |
|  9 | `cmnj0emr30003zyd97trlq8ou` | `TA39q3p75XRSWYAEaSF7dANtyksoa3sLge` | `ethereum` | `NULL` | USDT |
| 10 | `cmnj0en6q0005zyd9fx42bjua` | `TBATDh41qMQ1yeVYecneEvhpfayYmkAQWS` | `ethereum` | `NULL` | USDT |
| 11 | `cmnj0eo220009zyd97aaaitrx` | `TBWRDpQsW1ZVPGGaBAwVLNb7iqmVBuM1nj` | `ethereum` | `NULL` | USDT |
| 12 | `cmnj0eohq000bzyd953u6nnxy` | `TBYRhsZR7Mdn9ezpGVLwZiNVnGm8wZGLAD` | `ethereum` | `NULL` | USDT |
| 13 | `cmnj0eoxd000dzyd9sumbgkxt` | `TBZefVsyQpzzxc2WSCLbZBECvxVdzGqdtC` | `ethereum` | `NULL` | USDT |
| 14 | `cmnj0enme0007zyd9k8h0w73k` | `TBwghbQMsBC5xcUxE7ZpYXhfDMXZAfiFv6` | `ethereum` | `NULL` | USDT |
| 15 | `cmnj0n1gb001bgylu2fb56zcg` | `TC4VsFHJdZ66BdwobZxkudVZBVmQZgCP65` | `ethereum` | `NULL` | USDT |
| 16 | `cmnj0epd1000fzyd90x6qpzng` | `TC5UNu3LGrjjVCuLNDdVgjm4oL5cQAyFRZ` | `ethereum` | `NULL` | USDT |
| 17 | `cmnj0epso000hzyd9ebn46bxz` | `TCA7AfTSuDmgYk2VaezfPuZF4Z4X8wxwcQ` | `ethereum` | `NULL` | USDT |
| 18 | `cmnj0eq8c000jzyd9rng02xj8` | `TDNKsLvsY2iSznyghddXz7ZDRc4X3191Z8` | `ethereum` | `NULL` | USDT |
| 19 | `cmnj0ncou002rgyluk8iypcsn` | `TDdbRFoBTEmE3qiR69Y6rKRSG1hoF65QaE` | `ethereum` | `NULL` | USDT |
| 20 | `cmnj0n40u001ngyluaz240vjr` | `TDprk9jeYPVm6khkBp1u7fwuyJcEJFrPWD` | `ethereum` | `NULL` | USDT |
| 21 | `cmnj0n360001jgylun7iojkc9` | `TDwN1Eq62bqvVhfGAjdRRJjE46jsi5KNMV` | `ethereum` | `NULL` | USDT |
| 22 | `cmnj0eqo0000lzyd96ei747sc` | `TE3mCcPULjPUE7ykX7RArDPAhyahoy3d2j` | `ethereum` | `NULL` | USDT |
| 23 | `cmnj0mt8p0009gylub27kter4` | `TEAqwfMhXLaomXhZ8KeMhx3njGmQEDnsUR` | `ethereum` | `NULL` | USDT |
| 24 | `cmnj0msdd0005gyluj9hcv8hf` | `TEFph7dZoUN5233cGEzF6XFwRpjPF8fQDS` | `ethereum` | `NULL` | USDT |
| 25 | `cmnj0er3o000nzyd95fvplkcf` | `TF4J8Gp7zbS8NA3HLuxsLdx7Ebzr6weCGn` | `ethereum` | `NULL` | USDT |
| 26 | `cmnj0gg0h008bzyd9o2ijvnni` | `TFFvv7NAWmbcVfA7QN81mMvUC25TWj1WJx` | `ethereum` | `NULL` | USDT |
| 27 | `cmnj0erjb000pzyd9krqdluea` | `TFdHux43bs21qRsygv5WQWfgtbQeT6nXey` | `ethereum` | `NULL` | USDT |
| 28 | `cmnj0es1j000rzyd993b5l6im` | `TFrH3dcpnR3tADrAcfyJwiK4brsgf3B7PG` | `ethereum` | `NULL` | USDT |
| 29 | `cmnj0esh7000tzyd9ax8lzhq0` | `TFurWgnyNMq9bhLrLoT9FGnrLfAL2BtR5R` | `ethereum` | `NULL` | USDT |
| 30 | `cmnj0esww000vzyd9i9huuiio` | `TGDaYNWFXi9HJ7NacfETF15vhUH7eRhKzt` | `ethereum` | `NULL` | USDT |
| 31 | `cmnj0n03j0015gylu7rqnpzad` | `TGJVc32ig2u8tQsYMLE7KXHT5NDQroaVNU` | `ethereum` | `NULL` | USDT |
| 32 | `cmnj0ets7000zzyd9pah46g35` | `TGKgLatirRpTugS6wgCUKerjLbzWKXAVqx` | `ethereum` | `NULL` | USDT |
| 33 | `cmnj0eu7u0011zyd9qtcya13s` | `TGMFaAXH15oaW8MpcNHLid6NbMKWaaNPdC` | `ethereum` | `NULL` | USDT |
| 34 | `cmnj0ev350015zyd96qrlt3uz` | `TGRZZsD8gxahF5oE6C7K8LLRHqQzoPa5bX` | `ethereum` | `NULL` | USDT |
| 35 | `cmnj0n2ql001hgylua78w9u7f` | `TGUPpmW2bAnMCLe5ih2CFisfCHk4gTFDsx` | `ethereum` | `NULL` | USDT |
| 36 | `cmnj0etcj000xzyd9aik3absz` | `TGdpkwNVFjw2DnbHBCFKLvCygPVPz9w4iM` | `ethereum` | `NULL` | USDT |
| 37 | `cmnj0euni0013zyd95otn4w9b` | `TGpNzk9noyvCCdnFPuSg5cqptPs16LjXZq` | `ethereum` | `NULL` | USDT |
| 38 | `cmnj0n10w0019gyluutmkfh9q` | `TH96tFMn8KGiYSLiwcV3E2UiaJc8jmcbz3` | `ethereum` | `NULL` | USDT |
| 39 | `cmnj0evit0017zyd9cw1g8fct` | `THEQTsqPhRDDfgcfBW5npH5Lr9PZhpthrf` | `ethereum` | `NULL` | USDT |
| 40 | `cmnj0evyg0019zyd9cgom73s0` | `THHb5iMAbZgQYY19h6uY66y5xt6e11gcZC` | `ethereum` | `NULL` | USDT |
| 41 | `cmnj0ewts001dzyd9yg0qsbb3` | `THUqqeevBQS3EYordDJKwp8DLFknesnfCD` | `ethereum` | `NULL` | USDT |
| 42 | `cmnj0gemt0085zyd9v1n3vbtc` | `THh5woR8qfmDsNknQ3agPYzQSiRtMnKsTh` | `ethereum` | `NULL` | USDT |
| 43 | `cmnj0ewe4001bzyd9s8kgfmzz` | `THob8vRrpDybXeqZDj8ukQhMjJVJ5nCbTW` | `ethereum` | `NULL` | USDT |
| 44 | `cmnj0ex9n001fzyd98b9moor8` | `TJ812KESWjzJZGEWBPFCu74Js5zQS7jN5A` | `ethereum` | `NULL` | USDT |
| 45 | `cmnj0expb001hzyd9pf90ra0k` | `TJBg9SxwiUUoqJGk18vK9avxkuV8GrKMK7` | `ethereum` | `NULL` | USDT |
| 46 | `21979e8f-19d1-428f-be41-8cf5a3e74b7e` | `TJCBpxZ3yC7C7oegSRZMFxBcscmUVeSA36` | `ethereum` | `NULL` | **(aucun code)** |
| 47 | `cmnj0naga002hgylungcbeumq` | `TLM3zA3EWycoDX4ZX4gKze7sgfbdkntTum` | `ethereum` | `NULL` | USDT |
| 48 | `cmnj0ge760083zyd90auudpiw` | `TLNRT524dzL5FF1nJHDhYEMFpeWjLjRbz1` | `ethereum` | `NULL` | USDT |
| 49 | `cmnj0ey50001jzyd9389gfb6k` | `TLRMHPjLGXsVpD9RVzSfat6zDiVDrd4b4w` | `ethereum` | `NULL` | USDT |
| 50 | `cmnj0n3lf001lgylup3gz6abe` | `TM6Kix9wH8cYQ4rLpFifsQ4ddH3rPX3f8p` | `ethereum` | `NULL` | USDT |
| 51 | `cmnj0eykn001lzyd9pne442rt` | `TMECKT19hfumcK3KqQKbhxkn1ohyeR58xu` | `ethereum` | `NULL` | USDT |
| 52 | `cmnj0msta0007gylu3vzmrlph` | `TMGLqRQ4twjW8wJhVH1mQR7nUThpGHUsN3` | `ethereum` | `NULL` | USDT |
| 53 | `cmnj0ez0a001nzyd92e9xphx7` | `TMgnRWb9xFMtktny9Lzty21QYLLQD93ft6` | `ethereum` | `NULL` | USDT |
| 54 | `cmnj0ezfx001pzyd92n60nypb` | `TMiSGhXXVsvJzqwGbwAsGiFxWg2eALZoM5` | `ethereum` | `NULL` | USDT |
| 55 | `cmnj0f0b7001tzyd9yi1a1g0r` | `TPF9UQhqpV18BPWg5xo6MeB3h8t4iEg9gP` | `ethereum` | `NULL` | USDT |
| 56 | `cmnj0f16i001xzyd9jda8fftp` | `TPPR7e8hGC57dexrE2jy1f94wtuGyVP6Dp` | `ethereum` | `NULL` | USDT |
| 57 | `cmnj0ezvk001rzyd9hsfag1xm` | `TPcUZYthDfxNsHQnZZGBM1BDNBeNSjfPZE` | `ethereum` | `NULL` | USDT |
| 58 | `cmnj0f0qu001vzyd9cdco9w7e` | `TPo3JyryRcQ3uhBWexeYhtkpMitsUwY4uB` | `ethereum` | `NULL` | USDT |
| 59 | `cmnj0n1vr001dgylu4t2ejq83` | `TQ5mpZPbQMSq2s1vSM3RJgiB1AsTsiTpFZ` | `ethereum` | `NULL` | USDT |
| 60 | `cmnj0f1m7001zzyd9cx0alvhq` | `TQKQ4ntejdYYJpuYkFz8oCSDoXW6RKRDdY` | `ethereum` | `NULL` | USDT |
| 61 | `cmnj0f21v0021zyd95a9nlztp` | `TQthYM5nLqwAEr6DScC8tRtw29ncEB53mK` | `ethereum` | `NULL` | USDT |
| 62 | `cmnj0f2hj0023zyd9wuytxntr` | `TR18rEj7gWjKBJLYrowyfnvjWLTTsXGngK` | `ethereum` | `NULL` | USDT |
| 63 | `cmnj0f2x60025zyd92ipo3xxi` | `TRkGqvaobVp4XDNmSceRo5hDcJYDTFmYjd` | `ethereum` | `NULL` | USDT |
| 64 | `cmnj0gfks0089zyd90c5fv6au` | `TTAHMdqoom4f2VTWniroPWQHcTRZ4caoH4` | `ethereum` | `NULL` | USDT |
| 65 | `cmnj0f3v30029zyd9pnkqd411` | `TTUqoT6EAmiM1xLvwVwxhjvjaoEUGtKDdZ` | `ethereum` | `NULL` | USDT |
| 66 | `cmnj0f3ct0027zyd9wglp7t5x` | `TTct1DezYvriNWU7Wi3mygLoskkaw61mra` | `ethereum` | `NULL` | USDT |
| 67 | `cmnj0mzo40013gyluawom58ih` | `TTgcTTNbNuFdbrhvbjMZVrdU5KALyzDaPw` | `ethereum` | `NULL` | USDT |
| 68 | `cmnj0f4aq002bzyd9j7dvqdoj` | `TTzMs5AR66jr9mQMkWfCHVwd3AiLLYPepQ` | `ethereum` | `NULL` | USDT |
| 69 | `cmnj0f4qe002dzyd9cspomb3s` | `TUKsuPVb8kgJVFp5x528KC5HisUVdzxami` | `ethereum` | `NULL` | USDT |
| 70 | `cmnj0gf530087zyd9bkf0jf72` | `TV5ZTpKDszLTF6XcMnPongS33pwBgF91by` | `ethereum` | `NULL` | USDT |
| 71 | `cmnj0f561002fzyd9ifmxb4mo` | `TVDsEFm19zLV8HeXdt6G75rLroxnp6uqpV` | `ethereum` | `NULL` | USDT |
| 72 | `cmnj0ku0x00sdzyd9ful6rce8` | `TVacWx7F5wgMgn49L5frDf9KLgdYy8nPHL` | `ethereum` | `NULL` | USDT |
| 73 | `cmnj0n4g8001pgylunysx5dfe` | `TVn4q7L4fKEPbygi7UHq1CKfZxtbeuMV5q` | `ethereum` | `NULL` | USDT |
| 74 | `cmnj0f5lo002hzyd9k2lm67mf` | `TVu2SiQrWSnfwk8quAeDxfiaLy6FHzYkMA` | `ethereum` | `NULL` | USDT |
| 75 | `cmnj0f61b002jzyd9coywsbeb` | `TVyiDQ25H6Rx6PcNV1WyjGasGSa8ehj1Uv` | `ethereum` | `NULL` | USDT |
| 76 | `cmnj0f6gz002lzyd9f5uwso4f` | `TW3RgbhYkFEFnmRJ9mE9b83T9XYSMkjwuD` | `ethereum` | `NULL` | USDT |
| 77 | `cmnj0n8qk0029gylukdouofze` | `TWBAPzpPiZarfVsY2BLXeaLhNHurn4wkWG` | `ethereum` | `NULL` | USDT |
| 78 | `cmnj0f6wm002nzyd9bwspqyea` | `TWwv8FQiES3yHGig7y3zJWYuPaZfSV3vmY` | `ethereum` | `NULL` | USDT |
| 79 | `cmnj0j62b00krzyd9p85os1z2` | `TX5GV4DyfxNB3rPkzZJhmqZ1efVmL4rEqG` | `ethereum` | `NULL` | USDT |
| 80 | `cmnj0n2b7001fgyluki6l5k1i` | `TXEaKf4rT3rMoD3Vuqnuhwr6vLq6BL5t33` | `ethereum` | `NULL` | USDT |
| 81 | `cmnj0n0ix0017gylubkt6z05q` | `TXEsK1sEsKjZ1xtHitnyAAoqw3WLdYdRNW` | `ethereum` | `NULL` | USDT |
| 82 | `cmnj0f7rw002rzyd9brkuw1qb` | `TXFUYHVJMDyKikutvCG6qNgTUS5pxtZhHs` | `ethereum` | `NULL` | USDT |
| 83 | `cmnj0f7c9002pzyd9suqemsgh` | `TXc4kRiMEcdXRxWpSKkD5qKaARExN4uxPq` | `ethereum` | `NULL` | USDT |
| 84 | `cmnj0f87k002tzyd91e3s1k5w` | `TYD6a4PAAfAgegEdDf9oZUnW4DFmS8jeFT` | `ethereum` | `NULL` | USDT |
| 85 | `cmnj0f8n7002vzyd9azpma9rp` | `TYK29mbyvVxLaLUKdFSTRADMwoxaVbVZQg` | `ethereum` | `NULL` | USDT |
| 86 | `cmnj0f92u002xzyd96gmyn48a` | `TYxwUhoLPF7AgfG9GaXFEp8CQi8K8KG1m3` | `ethereum` | `NULL` | USDT |
