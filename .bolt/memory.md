# Project memory

## Product intent & audience

- Minecraft server website intended to attract and inform prospective and existing players.
- Primary goals are to showcase the server, provide quick access to community information, and let visitors view the server’s live world map.
- Audience includes new players evaluating the server and current players looking for navigation, events, and server resources.
- Framework: Vite + React.

## Brand personality & voice

- Friendly, welcoming, community-oriented, and adventure-focused.
- Clear, accessible copy with a polished game-community feel.
- Calls to action should emphasize joining, exploring, and discovering the server.

## Visual design & UX direction

- Homepage includes an enhanced hero, a highlights/stats strip, and a live-map teaser section.
- Live Map is accessible from both the main navigation and footer, with a prominent quick-access navigation action.
- Dedicated Live Map page uses tabs for:
  - Live map embed
  - Map legend
  - Navigation/exploration tips
- Embedded map area should be full-height and interactive, with loading feedback and an “Open full screen” action.
- When no map URL is configured, show a friendly explanatory placeholder instead of a broken embed.
- Map content should support either Dynmap or BlueMap through a configurable URL.
- Live-map teaser uses an animated compass motif and hover interaction to communicate exploration.
- Stats/highlights bar presents four concise server benefits: active community, fair play, lag-free experience, and weekly events.
- Preserve responsive navigation and ensure map controls, tabs, links, and embeds remain usable on smaller screens.
- Prefer clear visual hierarchy, recognizable icons, strong primary actions, and polished hover/focus states.

## Decisions, constraints & rationale

- Live map is a first-class site destination rather than only an external link.
- The map URL is stored in site configuration so deployment-specific server details do not need to be hardcoded into page content.
- The map page must gracefully support an unset URL with a placeholder state.
- Map guidance is split into legend and tips tabs to keep the embedded experience focused while still explaining markers and controls.
- Homepage changes are additive: retain existing site sections while adding stronger discovery and map visibility.
- Footer and navbar both expose the Live Map destination for discoverability.
- Build verification succeeded after the described changes.

## Open questions & assumptions

- The actual Dynmap or BlueMap URL has not yet been supplied/configured.
- Exact server name, branding, color palette, typography, and existing component conventions are not documented here.
- Confirm whether the map provider requires iframe permissions, fullscreen support, or special embedding headers.
- Confirm the intended meanings and visual colors for player, landmark, spawn, and safe-zone markers.
- Validate mobile behavior and iframe performance with the production map URL.