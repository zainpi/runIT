# The Last Echo — Spanish, Korean and Japanese

The player-facing pages of the game website are available in Spanish (`es`),
Korean (`ko`) and Japanese (`ja`). Guides, the gallery, the devlog and the
About page stay English; localized pages link to them with an "(English)" label.

| Page | English | Localized |
| --- | --- | --- |
| Home | `/the-last-echo/` | `/the-last-echo/<lang>/` |
| Support | `/the-last-echo/support.html` | `/the-last-echo/<lang>/support.html` |
| Privacy | `/the-last-echo/privacy.html` | `/the-last-echo/<lang>/privacy.html` |
| Terms and gacha odds | `/the-last-echo/terms.html` | `/the-last-echo/<lang>/terms.html` |
| Redeem a code | `/the-last-echo/redeem/` | `/the-last-echo/<lang>/redeem/` |

Every page in that table carries `hreflang` alternates for all four languages
and a language menu in its header. The folder routes are rewrites in
`next.config.mjs`; the localized home pages are in the sitemap.

## Keeping them in sync

The localized files are static copies of the English pages with translated
text. When an English page changes, make the same change in its three copies.
This matters most for:

- **Gacha odds, pity and featured-item rules** (terms §7). Korean law requires
  the odds to be shown in Korean, so a rate change must reach `ko/terms.html`
  in the same release.
- **Privacy and terms dates and clauses.** The translations state that the
  English text governs where the law allows, but they must still say the same
  thing.
- **Redeem page logic.** Only the text differs between the four copies. The
  `REDEEM_ERRORS` and `REWARD_META` keys and the RPC call must stay identical.

`npm run test:the-last-echo` checks that every page declares its language and
alternates, internal links resolve, the redeem pages keep every error and
reward key with no English messages left, and the translated odds tables match
the English one.

The pixel font `public/the-last-echo/fonts/monogram.ttf` was extended with
pixel-drawn Spanish accents (á é í ó ú ñ ü, their capitals, ¿ « » · – —).
Korean and Japanese fall back to the system's Korean or Japanese font.

## Glossary

Use these terms in the game, the website and the store listings so players see
the same words everywhere.

| English | Spanish | Korean | Japanese |
| --- | --- | --- | --- |
| Gems | Gemas | 젬 | ジェム |
| Gold | Oro | 골드 | ゴールド |
| Harpenny | Harpenny | 하페니 | ハーペニー |
| Summon Notes | Notas de invocación | 소환 노트 | 召喚ノート |
| Ability Echoes | Ecos de habilidad | 어빌리티 에코 | アビリティエコー |
| Weapon Cores | Núcleos de arma | 무기 코어 | 武器コア |
| Relic Tickets | Boletos de reliquia | 유물 티켓 | レリックチケット |
| Refinement Dust | Polvo de refinamiento | 정제 가루 | 精錬の粉 |
| Name Colour | Color del nombre | 닉네임 색상 | 名前の色 |
| Summon | Invocación | 소환 | 召喚 |
| Gacha | Gacha | 뽑기 | ガチャ |
| Pity (soft / hard) | Pity (suave / máximo) | 천장 (소프트 / 하드) | 天井（ソフト／ハード） |
| Featured item / banner | Objeto / banner destacado | 픽업 아이템 / 배너 | ピックアップ対象／バナー |
| Common | Común | 일반 | コモン |
| Uncommon | Poco común | 고급 | アンコモン |
| Rare | Raro | 희귀 | レア |
| Legendary | Legendario | 전설 | レジェンダリー |
| Mythic | Mítico | 신화 | ミシック |
| Transcendent | Trascendente | 초월 | トランセンデント |
| Divine | Divino | 신성 | ディバイン |
| Player ID | ID de jugador | 플레이어 ID | プレイヤーID |
| Display name | Nombre visible | 닉네임 | 表示名 |
| Settings → Account → Delete Account | Ajustes → Cuenta → Eliminar cuenta | 설정 → 계정 → 계정 삭제 | 設定 → アカウント → アカウント削除 |
| Mail / Claim | Correo / Reclamar | 우편함 / 받기 | メール／受け取る |
| Redeem code | Canjear código | 쿠폰 입력 | コード入力 |
| Prestige | Prestigio | 환생 | 転生 |
| World boss | Jefe mundial | 월드 보스 | ワールドボス |

The website names in-game screens with these terms (for example, "Ajustes" and
"우편함"). If a language ships on the website before the game is translated,
players will see different labels in the game.
