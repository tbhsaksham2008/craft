# Project memory

## Product intent & audience

- Minecraft server website for prospective and existing players.
- Core experiences include server discovery, community information, a live world map, and a player-facing store.
- Store supports browsing products, viewing product details, and account-based saved items.
- Audience includes new players evaluating the server and current players managing server resources, exploring the map, and saving products for later.
- Framework: Vite + React.

## Brand personality & voice

- Friendly, welcoming, community-oriented, and adventure-focused.
- Clear, accessible copy with a polished game-community feel.
- Calls to action should emphasize joining, exploring, discovering, and returning to the server store.
- Account and commerce messaging should remain reassuring and straightforward.

## Visual design & UX direction

- Homepage includes an enhanced hero, highlights/stats strip, and live-map teaser.
- Live Map is available from the main navigation and footer, with a prominent quick-access action.
- Dedicated Live Map page uses tabs for the live embed, map legend, and navigation/exploration tips.
- Embedded map should be interactive, full-height where practical, provide loading feedback, and offer an “Open full screen” action.
- If no map URL is configured, show a friendly explanatory placeholder rather than a broken embed.
- Live map currently targets `http://103.118.182.66:30096/`.
- Map content supports Dynmap or BlueMap through a configurable URL.
- Live-map teaser uses an animated compass motif and hover interaction to communicate exploration.
- Stats/highlights bar presents four concise benefits: active community, fair play, lag-free experience, and weekly events.
- Store product cards and product detail pages provide wishlist/save actions.
- Account area displays a player’s saved products and allows removal.
- Wishlist actions should clearly communicate saved/unsaved state and remain usable across responsive layouts.
- Preserve responsive navigation and usable map controls, tabs, links, embeds, product actions, and account views on smaller screens.
- Prefer clear hierarchy, recognizable icons, strong primary actions, and polished hover/focus states.

## Decisions, constraints & rationale

- Live Map is a first-class site destination rather than only an external link.
- The supplied map address is connected through site configuration rather than hardcoded page content.
- Map page gracefully supports an unset URL with a placeholder state.
- Map guidance is split into legend and tips tabs to keep the embedded experience focused.
- Homepage changes are additive and retain existing site sections.
- Footer and navbar both expose the Live Map destination.
- The configured map uses HTTP; an HTTPS deployment may block it as mixed content, so an HTTPS map endpoint may be required in production.
- Wishlist is a private, signed-in-player feature connected to product cards, product details, and the player account.
- Wishlist persistence uses a dedicated table keyed to the existing catalog/account model; access is restricted to the owning signed-in player.
- Wishlist state is provided through one shared connection rather than separate requests from every product card.
- Build verification completed successfully after connecting the map address and after the wishlist work, including correction of the provider file format and tightening anonymous table permissions.

## Open questions & assumptions

- Confirm whether the HTTP map endpoint is reachable from the deployed site and whether production will require an HTTPS equivalent.
- Confirm whether the map provider requires iframe permissions, fullscreen support, or special embedding headers.
- Confirm intended meanings and visual colors for player, landmark, spawn, and safe-zone markers.
- Validate mobile behavior and iframe performance with the configured map URL.
- Exact server name, branding, color palette, typography, and existing component conventions remain undocumented.
- Confirm whether wishlist behavior should later include sorting, filtering, notifications, or purchase-state indicators.
- Confirm the account authentication and catalog schema conventions if additional player features are added.