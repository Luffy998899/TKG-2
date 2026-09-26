# Drop your photos here

Save each photo in this folder with the **exact filename** below, then run:

```
node scripts/import-photos.mjs
```

That resizes each one, generates the blur placeholder and the 3D texture, and
updates the manifests. Nothing else needs editing.

Any of `.jpg` `.jpeg` `.png` `.webp` works. You can do a few at a time — a
file that is not here yet is skipped and that picture stays as it is.

| Filename | Which picture it replaces |
| --- | --- |
| `security-smart-home.jpg` | The Security & Smart Home division photo: homepage card, the 3D slab on the scroll journey, and the page hero. Use the full kit shot (panel, sensors and smoke alarm together). |
| `product-iq-panel-4.jpg` | Smart Panel product page and card |
| `product-outdoor-cameras.jpg` | Outdoor Cameras |
| `product-indoor-cameras.jpg` | Indoor Cameras |
| `product-video-doorbells.jpg` | Video Doorbell |
| `product-smart-locks.jpg` | Door Lock |
| `product-sensors.jpg` | Sensors |

Product shots are fitted onto the page background rather than cropped, so
nothing gets cut off the edges whatever shape the original is. The division
photo is cropped to fill its frame, so give it something that survives a
16:10 crop.

Once imported, the files in here are no longer used. Keep them as your
originals or delete them; this folder is not deployed.
