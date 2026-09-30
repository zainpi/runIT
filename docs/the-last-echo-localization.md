# The Last Echo: localized website pages

The player-facing pages of the game website are available in nine languages:
English (root), Spanish (`es`), French (`fr`), German (`de`), Brazilian
Portuguese (`pt-br`), Russian (`ru`), Japanese (`ja`), Korean (`ko`) and
Simplified Chinese (`zh-hans`). These match the nine languages the game ships in
(`zainpi/AncientHorizon`, `docs/localization.md`). Guides, the gallery, the
devlog and the About page stay English; localized pages link to them with an
"(English)" label in their own language.

| Page | English | Localized |
| --- | --- | --- |
| Home | `/the-last-echo/` | `/the-last-echo/<lang>/` |
| Support | `/the-last-echo/support.html` | `/the-last-echo/<lang>/support.html` |
| Privacy | `/the-last-echo/privacy.html` | `/the-last-echo/<lang>/privacy.html` |
| Terms and gacha odds | `/the-last-echo/terms.html` | `/the-last-echo/<lang>/terms.html` |
| Redeem a code | `/the-last-echo/redeem/` | `/the-last-echo/<lang>/redeem/` |

`scripts/the-last-echo-l10n.mjs` is the single list of languages. Run it after
adding or editing a localized page: it rewrites every page's `hreflang`
alternates and header language menu, and gives the pixel font a
`monogram-extended.ttf` fallback (CC0, same designer) for the accented and
Cyrillic letters `monogram.ttf` lacks. `--check` exits non-zero if anything is
stale. The folder routes are rewrites in `next.config.mjs`; the localized home
pages are in the sitemap.

## Keeping them in sync

The localized files are static copies of the English pages with translated
text. When an English page changes, make the same change in its eight copies.
This matters most for:

- **Gacha odds, pity and featured-item rules** (terms §7). Korean law requires
  the odds to be shown in Korean, so a rate change must reach `ko/terms.html`
  in the same release.
- **Privacy and terms dates and clauses.** The translations state that the
  English text governs where the law allows, but they must still say the same
  thing.
- **Redeem page logic.** Only the text differs between the nine copies. The
  `REDEEM_ERRORS` and `REWARD_META` keys and the RPC call must stay identical.

`npm run test:the-last-echo` (optionally `L10N_ONLY=fr,de`) checks that every page declares its language and
alternates, internal links resolve, the redeem pages keep every error and
reward key with no English messages left, and the translated odds tables match
the English one.

The pixel font `public/the-last-echo/fonts/monogram.ttf` was extended with
pixel-drawn Spanish accents; other Latin and Cyrillic letters fall back to
`monogram-extended.ttf` through the generator's `unicode-range` rule. Chinese,
Korean and Japanese use the system CJK fonts.

## Glossary

Use these terms in the game, the website and the store listings so players see
the same words everywhere. The table is taken from the game's own translation
files, so the website names in-game screens exactly as the game shows them.
Account deletion lives under Settings → Privacy → Delete Account & All Data;
signing in lives under Settings → Account.

| English | Spanish | French | German | Portuguese (BR) | Russian | Japanese | Korean | Chinese (Simplified) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Gems | Gemas | Gemmes | Juwelen | Gemas | Самоцветы | ジェム | 젬 | 宝石 |
| Gold | Oro | Or | Gold | Ouro | Золото | ゴールド | 골드 | 金币 |
| Harpenny | Harpenny | Harpenny | Harpenny | Harpenny | Харпенни | ハーペニー | 하페니 | 竖琴币 |
| Summon Notes | Notas de invocación | Notes d'invocation | Beschwörungsnoten | Notas de Invocação | Ноты призыва | 召喚ノート | 소환 노트 | 召唤音符 |
| Ability Echoes | Ecos de habilidad | Échos de compétence | Fähigkeits-Echos | Ecos de Habilidade | Эхо умений | アビリティエコー | 어빌리티 에코 | 技能回响 |
| Weapon Cores | Núcleos de arma | Noyaux d'arme | Waffenkerne | Núcleos de Arma | Ядра оружия | 武器コア | 무기 코어 | 武器核心 |
| Relic Tickets | Boletos de reliquia | Tickets de relique | Relikt-Tickets | Bilhetes de Relíquia | Билеты реликвий | レリックチケット | 유물 티켓 | 遗物券 |
| Refinement Dust | Polvo de refinamiento | Poussière d'affinage | Veredelungsstaub | Pó de Refino | Пыль заточки | 精錬の粉 | 정제 가루 | 精炼粉尘 |
| Summon | Invocación | Invocation | Beschwören | Invocar | Призыв | 召喚 | 소환 | 召唤 |
| Common | Común | Commun | Gewöhnlich | Comum | Обычный | コモン | 일반 | 普通 |
| Uncommon | Poco común | Peu commun | Ungewöhnlich | Incomum | Необычный | アンコモン | 고급 | 优秀 |
| Rare | Raro | Rare | Selten | Raro | Редкий | レア | 희귀 | 稀有 |
| Epic | Épico | Épique | Episch | Épico | Эпический | エピック | 영웅 | 史诗 |
| Legendary | Legendario | Légendaire | Legendär | Lendário | Легендарный | レジェンダリー | 전설 | 传说 |
| Mythic | Mítico | Mythique | Mythisch | Mítico | Мифический | ミシック | 신화 | 神话 |
| Transcendent | Trascendente | Transcendant | Transzendent | Transcendente | Запредельный | トランセンデント | 초월 | 超凡 |
| Divine | Divino | Divin | Göttlich | Divino | Божественный | ディバイン | 신성 | 神圣 |
| Prestige | Prestigio | Prestige | Prestige | Prestígio | Престиж | 転生 | 환생 | 转生 |
| Settings | Ajustes | Paramètres | Einstellungen | Configurações | Настройки | 設定 | 설정 | 设置 |
| Account | Cuenta | Compte | Konto | Conta | Аккаунт | アカウント | 계정 | 账号 |
| Privacy | Privacidad | Confidentialité | Datenschutz | Privacidade | Конфиденциальность | プライバシー | 개인정보 | 隐私 |
| Delete Account & All Data | Eliminar cuenta y todos los datos | Supprimer le compte et toutes les données | Konto & alle Daten löschen | Excluir Conta e Todos os Dados | Удалить аккаунт и все данные | アカウントとすべてのデータを削除 | 계정 및 모든 데이터 삭제 | 删除账号及所有数据 |
| Mail | Correo | Courrier | Post | Correio | Почта | メール | 우편함 | 邮件 |
| Claim | Reclamar | Récupérer | Abholen | Resgatar | Забрать | 受け取る | 받기 | 领取 |
| Player ID | ID de jugador | ID joueur | Spieler-ID | ID do Jogador | ID игрока | プレイヤーID | 플레이어 ID | 玩家ID |
| Pity (soft / hard) | Pity (suave / máximo) | Garantie (douce / totale) | Garantie (weich / hart) | garantia (suave / total) | гарант (мягкий / жёсткий) | 天井（ソフト／ハード） | 천장 (소프트 / 하드) | 保底（软 / 硬） |
