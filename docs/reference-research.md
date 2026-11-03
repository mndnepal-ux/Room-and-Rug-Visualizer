# MyRoom Studio reference research

## Sources inspected

- https://myroom.studio/ — homepage content, metadata, visual screenshot, publicly served application bundle and stylesheet.
- https://myroom.studio/studio?type=2D&room=Living%20Room%20Monitome&rug=Zabiz%20Dredus&variation=Zabiz%20Dredus%20Beige — linked studio entry.

## Product focus

MyRoom Studio presents rugs in furnished environments. Its core proposition is to upload a rug design or choose a collection design and see it in styled room scenes. It is not primarily a floor-plan editor or furniture-layout planner.

The homepage emphasizes realistic room imagery, a room gallery, and rug presentation for customers. The first viewport uses a full-room image, an orange accent, a dark overlay, and a prominent Experience action.

## Publicly exposed workflow

1. Enter a scene from the homepage or gallery.
2. Choose a room and a rug/design variation.
3. Upload a custom rug design if desired.
4. Change the room, rug, or available view.
5. Scale/reset the rug in supported 2D scenes.
6. Save or share the resulting presentation; fullscreen is also offered.

The public application includes room filters for 2D/3D, free/paid, high resolution, lighting, multishot, animated and panoramic scenes. These are observed interface/code affordances, not a claim that every filter or scene was interactively verified.

## Technical observations

- The public site is a client-rendered React/Vite application.
- Scene selection is represented in URL parameters such as `type`, `room`, `rug`, and `variation`.
- Rendering is integrated with external Explorug services. Reusing those services would require separate permission and an integration contract; they are not an available rendering backend for this project.
- Public CSS includes Raleway, Bodoni and Source Sans Pro; its characteristic orange is `#FF5100`.

## Implementation boundary

Room Studio is an independent browser-based visualization tool inspired by this workflow. It uses original scene assets and its own rug composition logic, rather than copying proprietary imagery, bundling the reference application, or depending on its rendering service.

The initial version does not promise arbitrary 3D camera movement, photometric material simulation, or true-to-scale measurements from a photograph. Perspective previews should be described accurately. Local saves are device/browser-local, not cloud accounts.

## Research limitations

Public pages, a visual screenshot, and public frontend assets were inspected. No account was created, purchase made, private API accessed, or paid rendering workflow tested. Search results for similarly named room planners were excluded because they are different products.
